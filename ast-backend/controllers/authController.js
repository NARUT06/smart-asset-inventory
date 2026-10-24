const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');
const {
    pick,
    toId,
    trimStr,
    parsePagination,
    paginationMeta,
} = require('../utils/helpers');
const { hashPassword, comparePassword } = require('../utils/password');
const { serializeUser } = require('../utils/serializers');
const { assertValid, maxLen, tooLong } = require('../utils/validation');
const { logActivity } = require('../services/auditService');

const EMAIL_RX = /^\S+@\S+\.\S+$/;

const signToken = (user) =>
    jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });

const validateUserData = (data) =>
    assertValid([
        [
            'fullName',
            data.fullName === undefined ||
                (data.fullName && maxLen(data.fullName, 120)),
            'fullName is required and must be at most 120 characters',
        ],
        [
            'email',
            data.email === undefined || EMAIL_RX.test(data.email),
            'Please provide a valid email',
        ],
        [
            'department',
            maxLen(data.department, 120),
            tooLong('department', 120),
        ],
    ]);

// POST /api/auth/register
// - First user ever registered becomes ADMIN (bootstrap, public)
// - After that only an ADMIN can create users
const register = asyncHandler(async (req, res) => {
    const userCount = await prisma.user.count();
    const isBootstrap = userCount === 0;

    if (!isBootstrap && (!req.user || req.user.role !== ROLES.ADMIN)) {
        throw new ApiError(403, 'Only an ADMIN can register new users');
    }

    const { fullName, email, password, role, department } = req.body;
    const data = {
        fullName: trimStr(fullName),
        email: String(email).trim().toLowerCase(),
        department: trimStr(department),
        role: isBootstrap ? ROLES.ADMIN : role, // undefined -> DB default (CUSTODIAN)
    };
    validateUserData(data);

    const user = await prisma.user.create({
        data: {
            ...data,
            passwordHash: await hashPassword(password),
            passwordChangedAt: new Date(),
        },
    });

    // تسجيل عملية إنشاء المستخدم
    await logActivity({
        userId: req.user?.id || user.id,
        action: isBootstrap ? 'BOOTSTRAP_ADMIN' : 'CREATE_USER',
        entity: 'USER',
        entityId: user.id,
        details: {
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            department: user.department,
        },
        req,
    });

    const payload = { success: true, data: { user: serializeUser(user) } };
    if (isBootstrap) payload.token = signToken(user);
    res.status(201).json(payload);
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (!user) {
        throw new ApiError(401, 'Invalid email or password');
    }

    // 1. Check if the account is temporarily locked due to repeated failed attempts
    const now = new Date();
    if (user.lockoutUntil && user.lockoutUntil > now) {
        const remainingMinutes = Math.ceil(
            (user.lockoutUntil - now) / (60 * 1000),
        );

        // تسجيل المحاولة أثناء فترة القفل أولاً قبل إطلاق الخطأ
        await logActivity({
            userId: user.id,
            action: 'BLOCKED_LOGIN_ATTEMPT',
            entity: 'USER',
            entityId: user.id,
            details: {
                email: user.email,
                lockoutUntil: user.lockoutUntil,
                remainingMinutes,
                reason: 'Login attempted while account is temporarily locked',
            },
            req,
        });

        throw new ApiError(
            429,
            `Account temporarily locked due to too many failed attempts. Please try again after ${remainingMinutes} minute(s).`,
        );
    }

    // 2. Verify password
    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
        const attempts = user.failedLoginAttempts + 1;
        const isLockedNow = attempts >= 5;
        // Lock account for 4 minutes
        const lockTime = isLockedNow
            ? new Date(Date.now() + 4 * 60 * 1000)
            : null;

        // Update failed attempts and set lockout timestamp if threshold reached
        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: isLockedNow ? 0 : attempts,
                lockoutUntil: lockTime,
            },
        });

        // Log failed login attempt in audit logs
        await logActivity({
            userId: user.id,
            action: isLockedNow
                ? 'ACCOUNT_TEMPORARILY_LOCKED'
                : 'FAILED_LOGIN_ATTEMPT',
            entity: 'USER',
            entityId: user.id,
            details: {
                email: user.email,
                failedAttempts: attempts,
                isLocked: isLockedNow,
            },
            req,
        });

        if (isLockedNow) {
            throw new ApiError(
                429,
                'Account has been locked for 4 minutes due to excessive failed login attempts.',
            );
        }

        throw new ApiError(401, 'Invalid email or password');
    }

    // 3. Verify account status
    if (!user.isActive) {
        throw new ApiError(403, 'This account has been deactivated');
    }

    // 4. Successful login: Reset counter and clear lockout if present
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lockoutUntil: null,
            },
        });
    }

    // Log successful login
    await logActivity({
        userId: user.id,
        action: 'LOGIN',
        entity: 'USER',
        entityId: user.id,
        details: {
            email: user.email,
            role: user.role,
        },
        req,
    });

    res.json({
        success: true,
        token: signToken(user),
        data: { user: serializeUser(user) },
    });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
    res.json({ success: true, data: { user: serializeUser(req.user) } });
});

// PATCH /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const current = await prisma.user.findUnique({
        where: { id: req.user.id },
    });

    if (
        !current ||
        !(await comparePassword(currentPassword, current.passwordHash))
    ) {
        throw new ApiError(401, 'Current password is incorrect');
    }
    const user = await prisma.user.update({
        where: { id: current.id },
        data: {
            passwordHash: await hashPassword(newPassword),
            passwordChangedAt: new Date(),
        },
    });

    // تسجيل عملية تغيير كلمة المرور
    await logActivity({
        userId: user.id,
        action: 'CHANGE_PASSWORD',
        entity: 'USER',
        entityId: user.id,
        details: { email: user.email },
        req,
    });

    res.json({
        success: true,
        message: 'Password updated',
        token: signToken(user),
    });
});

// GET /api/auth/users
const listUsers = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
        defaultLimit: 50,
    });
    const where = {};
    if (req.query.role) where.role = String(req.query.role);
    if (req.query.isActive !== undefined)
        where.isActive = String(req.query.isActive) === 'true';
    if (req.query.q) {
        const contains = { contains: String(req.query.q), mode: 'insensitive' };
        where.OR = [
            { fullName: contains },
            { email: contains },
            { department: contains },
        ];
    }

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
            skip,
            take: limit,
        }),
        prisma.user.count({ where }),
    ]);

    res.json({
        success: true,
        meta: paginationMeta(total, page, limit),
        data: users.map(serializeUser),
    });
});

// PATCH /api/auth/users/:id   (ADMIN)
const updateUser = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, 'User not found');

    const updates = pick(req.body, [
        'fullName',
        'role',
        'department',
        'isActive',
    ]);
    updates.fullName = trimStr(updates.fullName);
    updates.department = trimStr(updates.department);

    // Prevent an admin from locking themselves out
    if (user.id === req.user.id) {
        if (updates.role && updates.role !== ROLES.ADMIN) {
            throw new ApiError(400, 'You cannot remove your own ADMIN role');
        }
        if (updates.isActive === false)
            throw new ApiError(400, 'You cannot deactivate your own account');
    }

    validateUserData(updates);
    const saved = await prisma.user.update({ where: { id }, data: updates });

    // تسجيل عملية تحديث بيانات المستخدم وصلاحياته
    await logActivity({
        userId: req.user.id,
        action: 'UPDATE_USER',
        entity: 'USER',
        entityId: saved.id,
        details: {
            targetUserEmail: saved.email,
            updatedFields: updates,
        },
        req,
    });

    res.json({ success: true, data: { user: serializeUser(saved) } });
});

module.exports = {
    register,
    login,
    getMe,
    changePassword,
    listUsers,
    updateUser,
};
