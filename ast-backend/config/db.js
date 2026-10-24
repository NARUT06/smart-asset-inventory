const prisma = require('./prisma');

const connectDB = async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not defined in environment variables');
  await prisma.$connect();
  console.log('PostgreSQL connected (Prisma)');
};

const disconnectDB = () => prisma.$disconnect();

const isDbConnected = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

module.exports = { connectDB, disconnectDB, isDbConnected };
