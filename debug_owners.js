const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOwners() {
    try {
        const owners = await prisma.user.findMany({
            where: { role: 3 },
            include: {
                tenant: true
            }
        });
        console.log('--- OWNERS ---');
        owners.forEach(o => {
            console.log(`ID: ${o.id}, Name: ${o.name}, Email: ${o.email}, Tenant: ${o.tenant?.name || 'None'}`);
            if (o.tenant) {
                console.log(`  Tenant Status: ${o.tenant.status}, Plan ID: ${o.tenant.planId}, Subscription Status: ${o.tenant.subscriptionStatus}`);
            }
        });

        const allTenants = await prisma.tenant.findMany();
        console.log('\n--- ALL TENANTS ---');
        allTenants.forEach(t => {
            console.log(`ID: ${t.id}, Name: ${t.name}, Domain: ${t.domain}, Status: ${t.status}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkOwners();
