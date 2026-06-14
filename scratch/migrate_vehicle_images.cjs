const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

// Usage: node migrate_vehicle_images.cjs [--remote]
const isRemote = process.argv.includes('--remote');
const dbName = 'gv-cars-prod';
const remoteFlag = isRemote ? '--remote' : '';

console.log(`Starting vehicle images migration...`);
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
  // Dynamic fetch polyfill for older Node versions if needed
  const fetch = globalThis.fetch || require('node-fetch');

  // 1. Fetch vehicles with image_data
  console.log("Fetching vehicles...");
  const query = "SELECT id, image_data FROM vehicles WHERE image_data IS NOT NULL AND image_data != ''";
  const output = execWrangler(`d1 execute ${dbName} ${remoteFlag} --json --command="${query}"`);
  
  let vehicles = [];
  try {
    const parsed = JSON.parse(output);
    vehicles = Array.isArray(parsed) ? (parsed[0]?.results || parsed) : (parsed.results || []);
  } catch (e) {
    console.error("Failed to parse vehicles JSON output:", e.message);
  }

  console.log(`Found ${vehicles.length} vehicles to inspect.`);

  if (vehicles.length === 0) {
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

  const migrationPayloads = [];
  let vehiclesMigratedCount = 0;

  // 3. Process Vehicles
  for (const v of vehicles) {
    try {
      let imgs = [];
      try {
        imgs = JSON.parse(v.image_data);
        if (!Array.isArray(imgs)) {
          imgs = [v.image_data];
        }
      } catch (e) {
        // Fallback for single raw base64 string
        imgs = [v.image_data];
      }

      let needsMigration = false;
      const newImgs = [];

      for (const img of imgs) {
        if (typeof img === 'string') {
          if (img.startsWith('data:image')) {
            needsMigration = true;
            console.log(`  Resizing image for vehicle ${v.id.substring(0, 8)}...`);
            try {
              // Compress both high and low versions to avoid SQLITE_TOOBIG on migration
              const [highResBase64, lowResBase64] = await Promise.all([
                resizeImage(img, 800, 800, 0.7),
                resizeImage(img, 80, 80, 0.15)
              ]);
              newImgs.push({
                high: highResBase64,
                low: lowResBase64
              });
            } catch (err) {
              console.error(`  [Warning] Failed to resize image for vehicle ${v.id}:`, err.message);
              // Fallback
              newImgs.push({
                high: img,
                low: img
              });
            }
          } else {
            // Not a valid image string
            newImgs.push(img);
          }
        } else if (img && typeof img === 'object' && img.high && img.low) {
          // Already in new format
          newImgs.push(img);
        }
      }

      if (needsMigration) {
        migrationPayloads.push({
          id: v.id,
          image_data: JSON.stringify(newImgs)
        });
        vehiclesMigratedCount++;
      }
    } catch (e) {
      console.error(`Error parsing image_data for vehicle ${v.id}:`, e.message);
    }
  }

  console.log(`Vehicles processed. ${vehiclesMigratedCount} vehicles planned for migration.`);

  // 4. Close Browser
  await browser.close();
  console.log("Closed browser.");

  // 5. Execute updates via HTTPS POST requests
  if (migrationPayloads.length > 0) {
    console.log(`\nExecuting SQL migration via API...`);
    const domain = isRemote ? 'https://pizza-citzen-portal.pages.dev' : 'http://localhost:8788';
    
    for (let idx = 0; idx < migrationPayloads.length; idx++) {
      const payload = migrationPayloads[idx];
      console.log(`Migrating vehicle ${payload.id} (${idx + 1}/${migrationPayloads.length})...`);
      try {
        const response = await fetch(`${domain}/api/migrate-vehicle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Migration-Token': 'garage-migration-20260614'
          },
          body: JSON.stringify(payload)
        });
        
        const resText = await response.text();
        let resJson = {};
        try {
          resJson = JSON.parse(resText);
        } catch(e) {
          resJson = { error: resText };
        }

        if (response.ok && resJson.success) {
          console.log(`  Successfully migrated vehicle ${payload.id}`);
        } else {
          console.error(`  Failed migrating vehicle ${payload.id}: ${resJson.error || response.statusText}`);
        }
      } catch (err) {
        console.error(`  Error sending migration request for vehicle ${payload.id}:`, err.message);
      }
    }
    console.log("Migration completed!");
  } else {
    console.log("\nAll images are already migrated. No database updates required.");
  }
}

main().catch(console.error);
