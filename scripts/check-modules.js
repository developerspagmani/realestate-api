const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listModules() {
    try {
        const modules = await prisma.module.findMany();
        console.log('--- System Modules ---');
        modules.forEach(m => {
            console.log(`[${m.id}] ${m.name} (${m.slug})`);
        });

        const plans = await prisma.plan.findMany({ include: { modules: true } });
        console.log('\n--- Plans and Modules ---');
        plans.forEach(p => {
            console.log(`Plan: ${p.name} (${p.slug}) - ID: ${p.id}`);
            console.log('Modules:', p.modules.map(m => m.slug).join(', '));
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

listModules();
