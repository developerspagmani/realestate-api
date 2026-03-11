const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Starting Module Refinement Migration ---');

    // 1. Define Modules
    const modules = [
        {
            slug: 'marketing_hub',
            name: 'Marketing Hub',
            description: 'Email marketing campaigns and lead nurturing tools.'
        },
        {
            slug: 'social_posts',
            name: 'Social Media Post',
            description: 'Manage and schedule posts across Facebook, Instagram, LinkedIn, and Twitter.'
        },
        {
            slug: 'social_whatsapp',
            name: 'WhatsApp Business',
            description: 'WhatsApp marketing, automation, and chatbot integration.'
        },
        {
            slug: 'automation_engine',
            name: 'Automation Engine',
            description: 'AI-powered lead matching and workflow automation engine.'
        },
        {
            slug: 'widget_creator',
            name: 'Widget Creator',
            description: 'Create and embed property widgets on any external website.'
        },
        {
            slug: 'website_cms',
            name: 'Website & CMS',
            description: 'Comprehensive tool for website building and content management.'
        },
        {
            slug: 'discovery',
            name: 'Discovery Portal',
            description: 'AI Agent configuration and property discovery tools.'
        },
        {
            slug: 'deal_intelligence',
            name: 'Deal Closer (Lost Deal Intelligence)',
            description: 'Capture and analyze why deals were lost to improve sales conversion.'
        }
    ];

    const upsertedModules = [];
    for (const mod of modules) {
        const upserted = await prisma.module.upsert({
            where: { slug: mod.slug },
            update: {
                name: mod.name,
                description: mod.description,
                status: 1
            },
            create: {
                name: mod.name,
                slug: mod.slug,
                description: mod.description,
                status: 1
            }
        });
        upsertedModules.push(upserted);
        console.log(`Upserted module: ${mod.slug}`);
    }

    // 2. Identify Plans
    const planSlugs = ['configurable', 'pro-realestate', 'free-starter'];

    for (const planSlug of planSlugs) {
        const plan = await prisma.plan.findUnique({
            where: { slug: planSlug }
        });

        if (plan) {
            console.log(`Updating plan: ${planSlug}`);

            // Connect all refined modules to these plans
            await prisma.plan.update({
                where: { id: plan.id },
                data: {
                    modules: {
                        connect: upsertedModules.map(m => ({ id: m.id }))
                    }
                }
            });
        }
    }

    console.log('--- Migration Completed ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
