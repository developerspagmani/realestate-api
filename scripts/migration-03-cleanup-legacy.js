const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Cleaning Up Legacy Modules ---');

    const _supportedSlugs = [
        'marketing_hub',
        'social_posts',
        'social_whatsapp',
        'automation_engine',
        'widget_creator',
        'website_cms',
        'discovery'
    ];

    const legacySlugs = ['social_all', 'website', 'cms', '3d_viewer', 'analytics_pro'];

    for (const slug of legacySlugs) {
        const mod = await prisma.module.findUnique({ where: { slug } });
        if (mod) {
            console.log(`Deactivating/Removing legacy module: ${slug}`);
            // Unlink from all plans first (implicitly handled by deleting or updating status)
            // Just set status to 0 (inactive) so it doesn't show up in registration/fallback
            await prisma.module.update({
                where: { id: mod.id },
                data: { status: 0 }
            });
        }
    }

    console.log('--- Cleanup Completed ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
