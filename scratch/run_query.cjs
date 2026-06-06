const { execSync } = require('child_process');
try {
  const output = execSync('npx wrangler d1 execute D1_DB --remote --command "SELECT COUNT(*) FROM users"', { encoding: 'utf8' });
  console.log(output);
} catch (err) {
  console.error(err.stdout || err.stderr || err.message);
}
