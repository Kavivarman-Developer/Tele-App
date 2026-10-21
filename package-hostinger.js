const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const target = path.join(__dirname, 'bundle_hostinger');
if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

// Copy mobile/dist into bundle_hostinger
fs.cpSync(path.join(__dirname, 'mobile', 'dist'), target, { recursive: true });

// Copy server/dist into bundle_hostinger/dist
fs.cpSync(path.join(__dirname, 'server', 'dist'), path.join(target, 'dist'), { recursive: true });

// Archive using tar with standard forward slashes
const zipPath = path.join(__dirname, 'web-deploy.zip');
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

execSync(`tar -a -c -f "${zipPath}" -C "${target}" .`, { stdio: 'inherit' });

fs.rmSync(target, { recursive: true, force: true });
console.log('Successfully created all-in-one web-deploy.zip!');
