import { build } from 'vite';

async function run() {
  try {
    console.log("Starting build...");
    await build({
      logLevel: 'info',
      build: {
         minify: false
      }
    });
    console.log('Build complete');
  } catch (e) {
    console.error('BUILD FAILED', e);
  }
}

run();
