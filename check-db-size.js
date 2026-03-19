const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSizes() {
  try {
    const posts = await prisma.scheduledPost.findMany({
      take: 10,
      select: {
        id: true,
        title: true,
        imageData: true,
        videoData: true,
        executionResults: true
      }
    });

    console.log(`Checking ${posts.length} posts...`);
    posts.forEach(post => {
      const imageSize = post.imageData ? JSON.stringify(post.imageData).length : 0;
      const videoSize = post.videoData ? JSON.stringify(post.videoData).length : 0;
      const resultsSize = post.executionResults ? JSON.stringify(post.executionResults).length : 0;
      
      console.log(`Post ID: ${post.id}`);
      console.log(`  Title: ${post.title}`);
      console.log(`  imageData size: ${imageSize} chars`);
      console.log(`  videoData size: ${videoSize} chars`);
      console.log(`  executionResults size: ${resultsSize} chars`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSizes();
