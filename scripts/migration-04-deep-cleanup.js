const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Deep Cleaning Legacy Modules & Plan Connections ---');

    const legacySlugs = ['social_all', 'website', 'cms', '3d_viewer', 'analytics_pro'];

    // 1. Dectivate modules
    for (const slug of legacySlugs) {
        const mod = await prisma.module.findUnique({ where: { slug } });
        if (mod) {
            console.log(`Deactivating module: ${slug}`);
            await prisma.module.update({
                where: { id: mod.id },
                data: { status: 0 }
            });
        }
    }

    // 2. Disconnect non-active modules from ALL plans
    const plans = await prisma.plan.findMany({ include: { modules: true } });

    for (const plan of plans) {
        const _activeModules = plan.modules.filter(m => m.status === 1);
        const inactiveModuleIds = plan.modules.filter(m => m.status === 0).map(m => m.id);

        if (inactiveModuleIds.length > 0) {
            console.log(`Unlinking ${inactiveModuleIds.length} inactive modules from plan: ${plan.slug}`);
            await prisma.plan.update({
                where: { id: plan.id },
                data: {
                    modules: {
                        disconnect: inactiveModuleIds.map(id => ({ id }))
                    }
                }
            });
        }
    }

    console.log('--- Deep Cleanup Completed ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
