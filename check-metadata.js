const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMetadata() {
  try {
    const prop = await prisma.property.findFirst({
      where: { id: '0e9e41ee-ff5f-44fc-8bd1-d00310dee484' }
    });

    if (prop && prop.metadata) {
      const metaStr = JSON.stringify(prop.metadata);
      console.log('Metadata sample (first 1000 chars):');
      console.log(metaStr.substring(0, 1000));
      console.log('\nLength:', metaStr.length);
      
      // Look for repetitions or huge values
      const keys = Object.keys(prop.metadata);
      console.log('Metadata keys:', keys);
      
      keys.forEach(k => {
          const size = JSON.stringify(prop.metadata[k]).length;
          console.log(`  Key: ${k}, Size: ${size} chars`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkMetadata();
