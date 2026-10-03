const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error("Usage: node scripts/bump_version.js <new-version>");
  process.exit(1);
}

const cleanVer = newVersion.replace(/^v/, '');
const parts = cleanVer.split('.').map(Number);
if (parts.length < 3 || parts.some(isNaN)) {
  console.error("Invalid semver:", newVersion);
  process.exit(1);
}

const versionCode = parts[0] * 10000 + parts[1] * 100 + parts[2];
const rootDir = path.resolve(__dirname, '..');

// 1. package.json
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = cleanVer;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`[1/4] package.json -> ${cleanVer}`);

// 2. desktop/package.json
const desktopPkgPath = path.join(rootDir, 'desktop', 'package.json');
if (fs.existsSync(desktopPkgPath)) {
  const dpkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));
  dpkg.version = cleanVer;
  if (dpkg.build) {
    dpkg.build.artifactName = `PizzaPortal-Setup-\${version}.\${ext}`;
  }
  fs.writeFileSync(desktopPkgPath, JSON.stringify(dpkg, null, 2) + '\n', 'utf8');
  console.log(`[2/4] desktop/package.json -> ${cleanVer}`);
}

// 3. src/utils/updater.ts
const updaterPath = path.join(rootDir, 'src', 'utils', 'updater.ts');
let updater = fs.readFileSync(updaterPath, 'utf8');
updater = updater.replace(/export const CURRENT_VERSION = '[^']+';/, `export const CURRENT_VERSION = '${cleanVer}';`);
fs.writeFileSync(updaterPath, updater, 'utf8');
console.log(`[3/4] src/utils/updater.ts -> ${cleanVer}`);

// 4. android/app/build.gradle
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${cleanVer}"`);
fs.writeFileSync(gradlePath, gradle, 'utf8');
console.log(`[4/4] android/app/build.gradle -> versionName "${cleanVer}", versionCode ${versionCode}`);

console.log(`\nSuccessfully bumped all files to v${cleanVer}!`);
