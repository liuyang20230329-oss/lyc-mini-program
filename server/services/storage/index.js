const path = require('path');
const LocalStorageProvider = require('./local-storage');
const OssStorageProvider = require('./oss-storage');

const MODE = (process.env.STORAGE_MODE || 'local').toLowerCase();

function createStorage() {
  if (MODE === 'oss') {
    return new OssStorageProvider({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      cdnDomain: process.env.CDN_DOMAIN || '',
    });
  }
  const baseDir = process.env.LOCAL_UPLOAD_DIR
    ? path.resolve(process.env.LOCAL_UPLOAD_DIR)
    : path.join(__dirname, '..', '..', 'data', 'uploads');
  return new LocalStorageProvider(baseDir);
}

const storage = createStorage();

module.exports = { storage, STORAGE_MODE: MODE };
