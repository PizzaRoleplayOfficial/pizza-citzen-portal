const { execSync } = require('child_process');
try {
  const output = execSync('npx wrangler d1 execute D1_DB --remote --command "SELECT id, username, roblox_username FROM users LIMIT 30"', { encoding: 'utf8' });
  console.log(output);
} catch (err) {
  console.error(err.stdout || err.stderr || err.message);
}
