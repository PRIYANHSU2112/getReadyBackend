import fs from 'fs';
import path from 'path';

const servicesDir = './services';
const services = fs.readdirSync(servicesDir);

for (const s of services) {
  const appPath = path.join(servicesDir, s, 'src', 'app.js');
  if (fs.existsSync(appPath)) {
    let content = fs.readFileSync(appPath, 'utf8');
    if (!content.includes('express-async-errors')) {
      content = "import 'express-async-errors';\n" + content;
      fs.writeFileSync(appPath, content, 'utf8');
      console.log('Added express-async-errors to:', appPath);
    } else {
      console.log('Already present in:', appPath);
    }
  }
}
