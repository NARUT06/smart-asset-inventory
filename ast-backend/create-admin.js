const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // لو بتستخدم bcrypt غيرها لـ bcrypt

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.com';
    const plainPassword = 'Password123!';

    // تشفير كلمة السر
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(plainPassword, salt);

    // تحديث اليوزر لو موجود، أو إنشاؤه لو مش موجود (Upsert)
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash,
            role: 'ADMIN',
            isActive: true,
        },
        create: {
            fullName: 'System Admin',
            email,
            passwordHash,
            role: 'ADMIN',
            department: 'IT',
            isActive: true,
        },
    });

    console.log('✅ Admin user created/updated successfully:');
    console.log({ id: user.id, email: user.email, role: user.role });
    console.log(`🔑 Login Password is: ${plainPassword}`);
}

main()
    .catch((e) => {
        console.error('❌ Error creating user:', e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
