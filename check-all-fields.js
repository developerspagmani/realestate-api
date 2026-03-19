const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSizes() {
  try {
    const posts = await prisma.scheduledPost.findMany({
      include: {
        publishedPosts: true
      }
    });

    console.log(`Checking ${posts.length} posts...`);
    posts.forEach(post => {
      console.log(`\nPost ID: ${post.id} - Title: ${post.title}`);
      
      const fields = Object.keys(post);
      fields.forEach(field => {
        if (field === 'publishedPosts') return;
        const size = post[field] ? JSON.stringify(post[field]).length : 0;
        if (size > 100) {
           console.log(`  ${field}: ${size} chars`);
        }
      });

      if (post.publishedPosts) {
        console.log(`  publishedPosts count: ${post.publishedPosts.length}`);
        post.publishedPosts.forEach(pp => {
          const ppSize = JSON.stringify(pp).length;
          console.log(`    Published Post ID: ${pp.id} - Size: ${ppSize} chars`);
          
          if (ppSize > 1000) {
              Object.keys(pp).forEach(key => {
                  const size = pp[key] ? JSON.stringify(pp[key]).length : 0;
                  if (size > 1000) {
                      console.log(`      ${key}: ${size} chars`);
                  }
              });
          }
        });
      }
    });

    // Total JSON size of the list
    const totalSize = JSON.stringify(posts).length;
    console.log(`\nTotal JSON size of all posts: ${totalSize} chars (${(totalSize / 1024).toFixed(2)} KB)`);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSizes();
