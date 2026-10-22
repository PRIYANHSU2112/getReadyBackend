import fs from 'fs';

const cacheFiles = [
  'services/beautician-service/src/cache/beautician.cache.js',
  'services/content-service/src/cache/content.cache.js',
  'services/booking-service/src/cache/booking.cache.js',
  'services/catalog-service/src/cache/catalog.cache.js',
  'services/membership-service/src/cache/membership.cache.js',
  'services/wallet-service/src/cache/wallet.cache.js'
];

for (const f of cacheFiles) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    // Replace the connect catch block to safely disconnect and null out this.client
    content = content.replace(
      /await this\.client\.connect\(\)\.catch\(\(err\) => \{[\s\S]*?\}\);/,
      `await this.client.connect().catch((err) => {
        this.isReady = false;
        try { this.client.disconnect(); } catch {}
        this.client = null;
        logger.warn({ err: err.message }, 'Redis initial connect failed; memory fallback active');
      });`
    );
    fs.writeFileSync(f, content, 'utf8');
    console.log('Updated cache file:', f);
  }
}
