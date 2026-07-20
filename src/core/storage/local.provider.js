import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export class LocalProvider {
  constructor(basePath, appUrl) {
    this.basePath = basePath;
    this.appUrl = appUrl;
  }

  async upload(file) {
    await fs.mkdir(this.basePath, { recursive: true });
    const filename = `${uuidv4()}-${file.originalname}`;
    const dest = path.join(this.basePath, filename);
    await fs.writeFile(dest, file.buffer);
    return {
      provider: 'local',
      key: filename,
      url: `${this.appUrl}/uploads/${filename}`,
    };
  }

  async delete(key) {
    const dest = path.join(this.basePath, key);
    await fs.unlink(dest).catch(() => {});
  }

  getUrl(key) {
    return `${this.appUrl}/uploads/${key}`;
  }
}
