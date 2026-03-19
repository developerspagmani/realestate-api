const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStats() {
  try {
    const stats = await prisma.scheduledPost.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    console.log('Stats:', stats);

    const total = await prisma.scheduledPost.count();
    console.log('Total ScheduledPosts:', total);

    const totalPublished = await prisma.publishedPost.count();
    console.log('Total PublishedPosts:', totalPublished);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkStats();
