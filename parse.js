import fs from 'fs';
import { parse } from '@babel/parser';

try {
  const code = fs.readFileSync('src/App.tsx', 'utf-8');
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log('Babel parse successful');
} catch (e) {
  console.error('Babel parse error:', e);
}
