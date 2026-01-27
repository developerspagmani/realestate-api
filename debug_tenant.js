const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Connecting...');
    try {
        const tenant = await prisma.tenant.findFirst({
            where: { name: 'Elite Real Estate Ltd' }
        });
        if (tenant) {
            console.log('TENANT_ID:' + tenant.id);
        } else {
            console.log('Tenant not found');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

main();
