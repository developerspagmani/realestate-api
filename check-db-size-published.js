const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSizes() {
  try {
    const publishedPosts = await prisma.publishedPost.findMany({
      take: 20,
      select: {
        id: true,
        metrics: true,
        caption: true,
        mediaUrls: true
      }
    });

    console.log(`Checking ${publishedPosts.length} published posts...`);
    publishedPosts.forEach(post => {
      const metricsSize = post.metrics ? JSON.stringify(post.metrics).length : 0;
      const captionSize = post.caption ? post.caption.length : 0;
      const mediaSize = post.mediaUrls ? JSON.stringify(post.mediaUrls).length : 0;
      
      console.log(`Published Post ID: ${post.id}`);
      console.log(`  metrics size: ${metricsSize} chars`);
      console.log(`  caption size: ${captionSize} chars`);
      console.log(`  mediaUrls size: ${mediaSize} chars`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSizes();
