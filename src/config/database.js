const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined in environment variables');
}

const isDev = process.env.NODE_ENV === 'development';

// PERF-05 fix: Cache Prisma client in globalThis to prevent new instances on each serverless invocation
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: isDev ? ['error', 'warn'] : ['error'],
  errorFormat: 'pretty',
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}


const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
};

const getDatabaseInfo = () => {
  const url = process.env.DATABASE_URL;

  return {
    url: url?.replace(/\/\/.*@/, '//***:***@')
  };
};

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
  getDatabaseInfo,
};