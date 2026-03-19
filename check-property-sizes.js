const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPropertySizes() {
  try {
    const properties = await prisma.property.findMany({
      take: 10
    });

    console.log(`Checking ${properties.length} properties...`);
    properties.forEach(prop => {
      console.log(`\nProperty ID: ${prop.id} - Title: ${prop.title}`);
      
      const fields = Object.keys(prop);
      fields.forEach(field => {
        const value = prop[field];
        if (value) {
            const size = JSON.stringify(value).length;
            if (size > 1000) {
               console.log(`  ${field}: ${size} chars`);
            }
        }
      });
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkPropertySizes();
