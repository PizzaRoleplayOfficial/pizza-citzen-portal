@echo off
git add src/App.tsx src/utils/updater.ts package.json
git add android/app/build.gradle
git add src/views/MyGarageView.tsx
git add src/index.css
git commit -m "release: v1.8.1 - pull up mobile FAB to bottom 108px to fix bottom-nav overlapping"
git tag v1.8.1
git push origin main
git push origin v1.8.1
cmd /c npm run build
npx wrangler pages deploy dist --branch main
echo Done!
