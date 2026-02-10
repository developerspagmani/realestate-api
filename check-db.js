const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLeads() {
    try {
        const leads = await prisma.lead.findMany({
            include: {
                audienceGroups: true
            }
        });
        console.log('--- LEADS ---');
        leads.forEach(l => {
            console.log(`ID: ${l.id}, Name: ${l.name}, Email: ${l.email}, Groups: ${l.audienceGroups.map(g => g.name).join(', ')}`);
        });

        const groups = await prisma.audienceGroup.findMany({
            include: {
                _count: { select: { leads: true } }
            }
        });
        console.log('\n--- GROUPS ---');
        groups.forEach(g => {
            console.log(`ID: ${g.id}, Name: ${g.name}, Leads Count: ${g._count.leads}`);
        });

        const campaigns = await prisma.campaign.findMany({
            include: {
                group: true,
                template: true
            }
        });
        console.log('\n--- CAMPAIGNS ---');
        campaigns.forEach(c => {
            console.log(`ID: ${c.id}, Name: ${c.name}, Status: ${c.status}, Delivered: ${c.deliveredCount}, Opened: ${c.openedCount}, Clicked: ${c.clickedCount}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkLeads();
