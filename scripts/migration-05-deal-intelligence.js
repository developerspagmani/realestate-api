const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Registering Deal Intelligence Module ---');

    // 1. Create or Update the Module
    const dealModule = await prisma.module.upsert({
        where: { slug: 'deal_intelligence' },
        update: {
            name: 'Deal Closer (Lost Deal Intelligence)',
            description: 'Capture and analyze why deals were lost to improve sales conversion.',
            status: 1
        },
        create: {
            slug: 'deal_intelligence',
            name: 'Deal Closer (Lost Deal Intelligence)',
            description: 'Capture and analyze why deals were lost to improve sales conversion.',
            status: 1
        }
    });

    console.log(`Module ${dealModule.slug} is ready.`);

    // 2. Connect to Plans (Professional and Growth)
    const planSlugs = ['pro-realestate', 'growth'];

    for (const slug of planSlugs) {
        const plan = await prisma.plan.findUnique({ where: { slug } });
        if (plan) {
            await prisma.plan.update({
                where: { id: plan.id },
                data: {
                    modules: {
                        connect: { id: dealModule.id }
                    }
                }
            });
            console.log(`Connected Deal Intelligence to plan: ${slug}`);
        }
    }

    console.log('--- Done ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
