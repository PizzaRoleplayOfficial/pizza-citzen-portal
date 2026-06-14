const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

// Usage: node migrate_timeline_images.cjs [--remote]
const isRemote = process.argv.includes('--remote');
const dbName = 'gv-cars-prod';
const remoteFlag = isRemote ? '--remote' : '';

console.log(`Starting timeline images migration...`);
console.log(`Target database: ${dbName} (${isRemote ? 'Remote' : 'Local Miniflare'})\n`);

// Execution policy bypass helper for Windows
function execWrangler(args) {
  const command = `cmd /c npx wrangler ${args}`;
  try {
    return execSync(command, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
  } catch (err) {
    console.error(`Failed to execute wrangler command: ${command}`);
    console.error(err.message);
    throw err;
  }
}

async function main() {
  // 0. Ensure tables and columns exist
  console.log("Ensuring tables and columns exist...");
  try {
    const postsTableInfoOutput = execWrangler(`d1 execute ${dbName} ${remoteFlag} --json --command="PRAGMA table_info(timeline_posts)"`);
    const postsTableInfo = JSON.parse(postsTableInfoOutput);
    const postsCols = Array.isArray(postsTableInfo) ? (postsTableInfo[0]?.results || postsTableInfo) : (postsTableInfo.results || []);
    const postsColNames = postsCols.map(c => c.name);
    if (postsColNames.length === 0) throw new Error("No tables");
    if (!postsColNames.includes('image_data')) {
      console.log("Adding image_data column to timeline_posts...");
      execWrangler(`d1 execute ${dbName} ${remoteFlag} --command="ALTER TABLE timeline_posts ADD COLUMN image_data TEXT"`);
    }
  } catch (err) {
    console.log("Creating timeline_posts table if not exists...");
    execWrangler(`d1 execute ${dbName} ${remoteFlag} --command="CREATE TABLE IF NOT EXISTS timeline_posts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, content TEXT NOT NULL, image_data TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"`);
  }

  try {
    const commentsTableInfoOutput = execWrangler(`d1 execute ${dbName} ${remoteFlag} --json --command="PRAGMA table_info(timeline_comments)"`);
    const commentsTableInfo = JSON.parse(commentsTableInfoOutput);
    const commentsCols = Array.isArray(commentsTableInfo) ? (commentsTableInfo[0]?.results || commentsTableInfo) : (commentsTableInfo.results || []);
    const commentsColNames = commentsCols.map(c => c.name);
    if (commentsColNames.length === 0) throw new Error("No tables");
    if (!commentsColNames.includes('image_data')) {
      console.log("Adding image_data column to timeline_comments...");
      execWrangler(`d1 execute ${dbName} ${remoteFlag} --command="ALTER TABLE timeline_comments ADD COLUMN image_data TEXT"`);
    }
  } catch (err) {
    console.log("Creating timeline_comments table if not exists...");
    execWrangler(`d1 execute ${dbName} ${remoteFlag} --command="CREATE TABLE IF NOT EXISTS timeline_comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, parent_id TEXT, image_data TEXT, video_path TEXT);"`);
  }

  // 1. Fetch posts and comments with image_data
  console.log("Fetching timeline posts...");
  const postsOutput = execWrangler(`d1 execute ${dbName} ${remoteFlag} --json --command="SELECT id, image_data FROM timeline_posts WHERE image_data IS NOT NULL AND image_data != ''"`);
  let posts = [];
  try {
    const parsed = JSON.parse(postsOutput);
    // Wrangler output can be an array of result objects or direct array depending on version
    posts = Array.isArray(parsed) ? (parsed[0]?.results || parsed) : (parsed.results || []);
  } catch (e) {
    console.error("Failed to parse posts JSON output:", e.message);
  }

  console.log(`Found ${posts.length} posts to inspect.`);

  console.log("Fetching timeline comments...");
  const commentsOutput = execWrangler(`d1 execute ${dbName} ${remoteFlag} --json --command="SELECT id, image_data FROM timeline_comments WHERE image_data IS NOT NULL AND image_data != ''"`);
  let comments = [];
  try {
    const parsed = JSON.parse(commentsOutput);
    comments = Array.isArray(parsed) ? (parsed[0]?.results || parsed) : (parsed.results || []);
  } catch (e) {
    console.error("Failed to parse comments JSON output:", e.message);
  }

  console.log(`Found ${comments.length} comments to inspect.`);

  if (posts.length === 0 && comments.length === 0) {
    console.log("No images found to migrate.");
    return;
  }

  // 2. Start Playwright browser
  console.log("\nLaunching Headless Chromium via Playwright...");
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  
  // Helper function to resize images using Canvas API in browser context
  async function resizeImage(base64Str, maxWidth = 80, maxHeight = 80, quality = 0.15) {
    return await page.evaluate(async ({ base64Str, maxWidth, maxHeight, quality }) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          
          canvas.width = Math.floor(width);
          canvas.height = Math.floor(height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Image failed to load in browser Canvas'));
        img.src = base64Str;
      });
    }, { base64Str, maxWidth, maxHeight, quality });
  }

  const sqlStatements = [];

  // 3. Process Posts
  console.log("\nProcessing posts images...");
  let postsMigratedCount = 0;
  for (const post of posts) {
    try {
      const imgs = JSON.parse(post.image_data);
      if (!Array.isArray(imgs)) continue;

      let needsMigration = false;
      const newImgs = [];

      for (const img of imgs) {
        if (typeof img === 'string') {
          // Old string format, needs migration
          needsMigration = true;
          console.log(`  Resizing image for post ${post.id.substring(0, 8)}...`);
          try {
            const lowResBase64 = await resizeImage(img);
            newImgs.push({
              high: img,
              low: lowResBase64
            });
          } catch (err) {
            console.error(`  [Warning] Failed to resize image for post ${post.id}:`, err.message);
            // Fallback: use high-res as low-res if resize fails
            newImgs.push({
              high: img,
              low: img
            });
          }
        } else if (img && typeof img === 'object' && img.high && img.low) {
          // Already in new format
          newImgs.push(img);
        }
      }

      if (needsMigration) {
        const escapedJson = JSON.stringify(newImgs).replace(/'/g, "''");
        sqlStatements.push(`UPDATE timeline_posts SET image_data = '${escapedJson}' WHERE id = '${post.id}';`);
        postsMigratedCount++;
      }
    } catch (e) {
      console.error(`Error parsing image_data for post ${post.id}:`, e.message);
    }
  }
  console.log(`Posts processed. ${postsMigratedCount} posts planned for migration.`);

  // 4. Process Comments
  console.log("\nProcessing comments images...");
  let commentsMigratedCount = 0;
  for (const comment of comments) {
    try {
      const imgs = JSON.parse(comment.image_data);
      if (!Array.isArray(imgs)) continue;

      let needsMigration = false;
      const newImgs = [];

      for (const img of imgs) {
        if (typeof img === 'string') {
          needsMigration = true;
          console.log(`  Resizing image for comment ${comment.id.substring(0, 8)}...`);
          try {
            const lowResBase64 = await resizeImage(img);
            newImgs.push({
              high: img,
              low: lowResBase64
            });
          } catch (err) {
            console.error(`  [Warning] Failed to resize image for comment ${comment.id}:`, err.message);
            newImgs.push({
              high: img,
              low: img
            });
          }
        } else if (img && typeof img === 'object' && img.high && img.low) {
          newImgs.push(img);
        }
      }

      if (needsMigration) {
        const escapedJson = JSON.stringify(newImgs).replace(/'/g, "''");
        sqlStatements.push(`UPDATE timeline_comments SET image_data = '${escapedJson}' WHERE id = '${comment.id}';`);
        commentsMigratedCount++;
      }
    } catch (e) {
      console.error(`Error parsing image_data for comment ${comment.id}:`, e.message);
    }
  }
  console.log(`Comments processed. ${commentsMigratedCount} comments planned for migration.`);

  // 5. Close Browser
  await browser.close();
  console.log("Closed browser.");

  // 6. Execute updates
  if (sqlStatements.length > 0) {
    const sqlFilePath = path.join(__dirname, 'migration_temp.sql');
    fs.writeFileSync(sqlFilePath, sqlStatements.join('\n'), 'utf8');
    console.log(`\nGenerated SQL migration file with ${sqlStatements.length} updates.`);
    
    console.log(`Executing SQL migration on D1...`);
    try {
      execWrangler(`d1 execute ${dbName} ${remoteFlag} --file="${sqlFilePath}"`);
      console.log("SQL Migration executed successfully!");
    } catch (err) {
      console.error("Failed to execute SQL migration on D1.");
    } finally {
      // Clean up temporary SQL file
      if (fs.existsSync(sqlFilePath)) {
        fs.unlinkSync(sqlFilePath);
      }
    }
  } else {
    console.log("\nAll images are already migrated. No database updates required.");
  }
}

main().catch(console.error);
