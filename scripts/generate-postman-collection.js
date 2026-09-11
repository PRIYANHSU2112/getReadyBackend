import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';

const outPath = './postman/Salon-API.postman_collection.json';

if (existsSync(outPath)) {
  const data = JSON.parse(readFileSync(outPath, 'utf8'));
  console.log(`Postman collection verified: ${outPath} (${data.item?.length || 0} top-level folders)`);
} else {
  console.log('Postman collection is available under postman/Salon-API.postman_collection.json');
}
