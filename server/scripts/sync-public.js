const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
// Target 1: ../mobile/dist (used by Nginx in production: /var/www/call.okboz.co.in/mobile/dist)
const targetDist = path.join(__dirname, '..', '..', 'mobile', 'dist');

const pages = ['privacy', 'landing', 'terms'];

function syncTo(target) {
  if (!fs.existsSync(target)) return false;
  
  pages.forEach(page => {
    const srcHtml = path.join(publicDir, `${page}.html`);
    if (!fs.existsSync(srcHtml)) return;

    // 1. Copy as [page].html (e.g. mobile/dist/privacy.html)
    fs.copyFileSync(srcHtml, path.join(target, `${page}.html`));

    // 2. Copy as [page]/index.html (e.g. mobile/dist/privacy/index.html)
    const dir = path.join(target, page);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(srcHtml, path.join(dir, 'index.html'));
  });

  console.log(`[sync-public] Successfully synced static pages to ${target}`);
  return true;
}

syncTo(targetDist);
// Also sync to /var/www/call.okboz.co.in/mobile/dist if on linux server
syncTo('/var/www/call.okboz.co.in/mobile/dist');
// Also sync to /var/www/call.okboz.co.in/web if exists
syncTo('/var/www/call.okboz.co.in/web');
