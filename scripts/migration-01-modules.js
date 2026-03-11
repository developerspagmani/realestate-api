const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupModulesAndPlan() {
    try {
        console.log('--- Setting up Modules and Plans ---');

        // 1. Create Social Media Hub module
        const socialModule = await prisma.module.upsert({
            where: { slug: 'social_all' },
            update: { name: 'Social Media Hub' },
            create: {
                name: 'Social Media Hub',
                slug: 'social_all',
                description: 'Manage social posts, WhatsApp campaigns, and social interactions.'
            }
        });
        console.log(`✅ Module: ${socialModule.name} (${socialModule.slug})`);

        // 2. Create Automation Engine module
        const automationModule = await prisma.module.upsert({
            where: { slug: 'automation_engine' },
            update: { name: 'Automation Engine' },
            create: {
                name: 'Automation Engine',
                slug: 'automation_engine',
                description: 'Automation Hub and Matching Engine for lead nurturing and property matching.'
            }
        });
        console.log(`✅ Module: ${automationModule.name} (${automationModule.slug})`);

        // 3. Find or Create Configurable Plan
        let configurablePlan = await prisma.plan.findFirst({
            where: { OR: [{ slug: 'configurable' }, { name: { contains: 'Configurable', mode: 'insensitive' } }] }
        });

        if (!configurablePlan) {
            console.log('Creating new Configurable Plan...');
            configurablePlan = await prisma.plan.create({
                data: {
                    name: 'Configurable Plan',
                    slug: 'configurable',
                    description: 'Customizable plan with selected modules.',
                    price: 99.00,
                    interval: 'monthly',
                    status: 1,
                    features: { highlights: ['Choose your own modules'] }
                }
            });
        } else {
            console.log(`Found existing plan: ${configurablePlan.name} (${configurablePlan.slug})`);
        }

        // 4. Link modules to the plan
        await prisma.plan.update({
            where: { id: configurablePlan.id },
            data: {
                modules: {
                    connect: [
                        { id: socialModule.id },
                        { id: automationModule.id }
                    ]
                }
            }
        });
        console.log(`✅ Linked modules to plan: ${configurablePlan.name}`);

        // Optional: Add them to Professional plan too if requested (often requested together)
        const proPlan = await prisma.plan.findUnique({ where: { slug: 'pro-realestate' } });
        if (proPlan) {
            await prisma.plan.update({
                where: { id: proPlan.id },
                data: {
                    modules: {
                        connect: [
                            { id: socialModule.id },
                            { id: automationModule.id }
                        ]
                    }
                }
            });
            console.log('✅ Also added to Professional Plan');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setupModulesAndPlan();
