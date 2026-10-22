import fs from 'fs';

const { results } = JSON.parse(fs.readFileSync('c:/projects/GR/Backend/scripts/api_qa_test_results.json', 'utf8'));
const failed = results.filter(r => r.testStatus !== 'PASS');
console.log('Total non-pass:', failed.length);

const grouped = {};
for (const f of failed) {
  if (!grouped[f.serviceName]) grouped[f.serviceName] = [];
  grouped[f.serviceName].push({
    method: f.method,
    endpoint: f.endpoint,
    statusCode: f.actualStatusCode,
    bug: f.bugDetails
  });
}

for (const [svc, items] of Object.entries(grouped)) {
  console.log('\n=== ' + svc + ' (' + items.length + ') ===');
  for (const item of items) {
    console.log('  ' + item.method + ' ' + item.endpoint + ' [' + item.statusCode + '] - ' + item.bug.slice(0, 90));
  }
}
