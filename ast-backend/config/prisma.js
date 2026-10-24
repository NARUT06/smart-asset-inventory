const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');

const immutable = async () => {
  throw new ApiError(405, 'Custody transfers are immutable: updates and deletes are not allowed');
};

const createClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  }).$extends({
    query: {
      // CustodyTransfer is an append-only audit trail (create + read only)
      custodyTransfer: {
        update: immutable,
        updateMany: immutable,
        upsert: immutable,
        delete: immutable,
        deleteMany: immutable,
      },
    },
  });

// Singleton: one client (and one connection pool) for the whole process
const globalForPrisma = globalThis;
const prisma = globalForPrisma.__astPrisma || createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__astPrisma = prisma;

module.exports = prisma;
