import fs from 'fs';

const { results } = JSON.parse(fs.readFileSync('c:/projects/GR/Backend/scripts/api_qa_test_results.json', 'utf8'));

const nonPass = results.filter(r => r.testStatus !== 'PASS');
console.log(`Total Non-Pass: ${nonPass.length}`);

const grouped = {};
for (const r of nonPass) {
  const sev = r.severity || 'Medium';
  const svc = r.serviceName;
  if (!grouped[svc]) grouped[svc] = [];
  grouped[svc].push({
    method: r.method,
    endpoint: r.endpoint,
    statusCode: r.actualStatusCode,
    status: r.testStatus,
    severity: sev,
    bug: r.bugDetails,
    remarks: r.remarks
  });
}

for (const [svc, bugs] of Object.entries(grouped)) {
  console.log(`\n### ${svc} (${bugs.length} issues)`);
  for (const b of bugs) {
    console.log(`- [${b.status} - ${b.severity}] ${b.method} ${b.endpoint} -> Status ${b.statusCode}: ${b.bug}`);
  }
}
