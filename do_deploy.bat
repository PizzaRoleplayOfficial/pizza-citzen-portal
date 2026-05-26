@echo off
npm run build && npx wrangler pages deploy dist --branch main
