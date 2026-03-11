const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const modules = await prisma.module.findMany();
        console.log('--- Modules ---');
        console.log(JSON.stringify(modules, null, 2));

        const plans = await prisma.plan.findMany({ include: { modules: true } });
        console.log('\n--- Plans ---');
        console.log(JSON.stringify(plans, null, 2));

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
