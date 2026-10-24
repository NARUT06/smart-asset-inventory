const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query } = require('express-validator');
const {
  register,
  login,
  getMe,
  changePassword,
  listUsers,
  updateUser,
} = require('../controllers/authController');
const { protect, optionalAuth, authorize } = require('../middleware/authMiddleware');
const { validate, idParam } = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later' },
});

const passwordRule = (field) =>
  body(field).isString().isLength({ min: 8, max: 128 }).withMessage(`${field} must be 8-128 characters`);

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication, account profile management, and identity administration
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new system user
 *     description: Creates a new user profile. Role assignment defaults to standard privileges unless granted by an Admin.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Omar Auditor
 *               email:
 *                 type: string
 *                 format: email
 *                 example: auditor@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *               role:
 *                 type: string
 *                 enum: [ADMIN, PROCUREMENT, CUSTODIAN, TECHNICIAN, AUDITOR]
 *                 example: AUDITOR
 *               department:
 *                 type: string
 *                 example: Internal Audit & Compliance
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Email already in use or validation failure
 *       429:
 *         description: Too many requests. Rate limit reached.
 */
router.post(
  '/register',
  authLimiter,
  optionalAuth,
  [
    body('fullName').trim().notEmpty().withMessage('fullName is required'),
    body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
    passwordRule('password'),
    body('role').optional().isIn(Object.values(ROLES)).withMessage('Invalid role'),
    body('department').optional().isString().trim(),
  ],
  validate,
  register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and obtain access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token and profile info
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many requests. Rate limit reached.
 */
router.post(
  '/login',
  authLimiter,
  [
    body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isString().notEmpty().withMessage('password is required'),
  ],
  validate,
  login
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get profile details of the currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile data retrieved successfully
 *       401:
 *         description: Unauthorized (Token missing or invalid)
 */
router.get('/me', protect, getMe);

/**
 * @swagger
 * /api/auth/change-password:
 *   patch:
 *     summary: Update the current authenticated user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: Password123!
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: NewSecretPass456!
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Incorrect current password or validation error
 *       401:
 *         description: Unauthorized
 */
router.patch(
  '/change-password',
  protect,
  [body('currentPassword').isString().notEmpty(), passwordRule('newPassword')],
  validate,
  changePassword
);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Retrieve list of users with optional role filtering
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, PROCUREMENT, CUSTODIAN, TECHNICIAN, AUDITOR]
 *         description: Filter users by system role
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/users',
  protect,
  [query('role').optional().isIn(Object.values(ROLES))],
  validate,
  listUsers
);

/**
 * @swagger
 * /api/auth/users/{id}:
 *   patch:
 *     summary: Update user permissions, role, status, or details
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target user ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Mohamed Senior Technician
 *               role:
 *                 type: string
 *                 enum: [ADMIN, PROCUREMENT, CUSTODIAN, TECHNICIAN, AUDITOR]
 *               department:
 *                 type: string
 *                 example: Hardware Maintenance & Engineering
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         description: User not found
 */
router.patch(
  '/users/:id',
  protect,
  authorize(ROLES.ADMIN),
  [
    idParam(),
    body('fullName').optional().isString().trim().notEmpty(),
    body('role').optional().isIn(Object.values(ROLES)),
    body('department').optional().isString().trim(),
    body('isActive').optional().isBoolean().toBoolean(),
  ],
  validate,
  updateUser
);

module.exports = router;