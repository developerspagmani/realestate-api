const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const modules = [
        { name: 'Website Builder', slug: 'website', description: 'Access to create and manage property websites' },
        { name: 'CMS Portal', slug: 'cms', description: 'Manage custom pages and content' },
        { name: 'Brochure Intelligent', slug: 'brochure_ai', description: 'AI-powered property brochure generator' }
    ];

    for (const m of modules) {
        await prisma.module.upsert({
            where: { slug: m.slug },
            update: { name: m.name, description: m.description },
            create: m
        });
    }
    console.log('Modules seeded successfully');
}

main().catch(console.error).finally(() => prisma.$disconnect());
