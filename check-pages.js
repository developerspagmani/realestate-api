const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPages() {
    try {
        const count = await prisma.page.count();
        console.log(`Successfully connected. Pages count: ${count}`);
    } catch (e) {
        console.error('Failed to access pages table:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkPages();
