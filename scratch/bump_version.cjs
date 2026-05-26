const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// 1. package.json のバンプ
const pkgPath = path.join(rootDir, 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '1.8.2';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log("UPDATED: package.json to v1.8.2");

// 2. src/utils/updater.ts のバンプ
const updaterPath = path.join(rootDir, 'src', 'utils', 'updater.ts');
let updater = fs.readFileSync(updaterPath, 'utf8');
updater = updater.replace(/export const CURRENT_VERSION = '[^']+';/, "export const CURRENT_VERSION = '1.8.2';");
fs.writeFileSync(updaterPath, updater, 'utf8');
console.log("UPDATED: src/utils/updater.ts to v1.8.2");

// 3. android/app/build.gradle のバンプ
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode \d+/, "versionCode 62");
gradle = gradle.replace(/versionName "[^"]+"/, 'versionName "1.8.2"');
fs.writeFileSync(gradlePath, gradle, 'utf8');
console.log("UPDATED: android/app/build.gradle to versionCode 62 and versionName v1.8.2");
