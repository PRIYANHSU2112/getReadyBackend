import { StorageService } from '../packages/storage/src/index.js';

async function run() {
  console.log('Testing DigitalOcean Spaces Connection...');
  const storage = new StorageService({
    bucket: 'satyakabir-bucket',
    region: 'sgp1',
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    accessKeyId: 'DO003NRRKMN4DTETPLGA',
    secretAccessKey: 'M5kmv62vtYMFrOwv2duhltYAAHLo26BbGeckKaG1lfE',
  });

  const testKey = `test/test-connection-${Date.now()}.txt`;
  const buffer = Buffer.from('GetReady S3 Centralized Storage connection verified successfully.');

  try {
    console.log(`Uploading test file to ${testKey}...`);
    const uploadResult = await storage.uploadBuffer({
      buffer,
      key: testKey,
      contentType: 'text/plain',
      isPublic: true,
    });
    console.log('Upload Result:', uploadResult);

    console.log('Checking exists...');
    const exists = await storage.exists(testKey);
    console.log('Exists:', exists);

    console.log('Generating presigned upload URL...');
    const presigned = await storage.getPresignedUploadUrl({
      key: `presigned-test/${Date.now()}.jpg`,
      contentType: 'image/jpeg',
    });
    console.log('Presigned Upload URL:', presigned);

    console.log('Cleaning up test file...');
    await storage.deleteObject(testKey);
    console.log('Test file deleted successfully!');
    console.log('ALL STORAGE TESTS PASSED!');
  } catch (err) {
    console.error('Storage test failed:', err);
    process.exit(1);
  }
}

run();
