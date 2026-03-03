const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const moduleSlug = 'brochure_ai';
    const planSlugs = ['pro-realestate', 'growth']; // Typically added to professional plan

    const module = await prisma.module.findUnique({ where: { slug: moduleSlug } });
    if (!module) {
        console.error('Module brochure_ai not found. Please run seedModules.js first.');
        return;
    }

    for (const planSlug of planSlugs) {
        const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
        if (plan) {
            await prisma.plan.update({
                where: { slug: planSlug },
                data: {
                    modules: {
                        connect: { id: module.id }
                    }
                }
            });
            console.log(`Module ${moduleSlug} linked to plan ${planSlug}`);
        } else {
            console.log(`Plan ${planSlug} not found`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
