const OSS = require('ali-oss');
const StorageProvider = require('./storage-provider');

class OssStorageProvider extends StorageProvider {
  constructor(options) {
    super();
    this.bucket = options.bucket;
    this.region = options.region;
    this.cdnDomain = options.cdnDomain || '';
    this.client = new OSS({
      region: options.region,
      accessKeyId: options.accessKeyId,
      accessKeySecret: options.accessKeySecret,
      bucket: options.bucket,
    });
  }

  _key(key) {
    return key.startsWith('media/') ? key : `media/${key}`;
  }

  async save(buffer, key, mimetype) {
    const objectKey = this._key(key);
    await this.client.put(objectKey, buffer, { mime: mimetype });
    return { key: objectKey, size: buffer.length, mimetype };
  }

  async saveFromFile(filePath, key, mimetype) {
    const objectKey = this._key(key);
    await this.client.put(objectKey, filePath, { mime: mimetype });
    return { key: objectKey, mimetype };
  }

  async getReadStream(key, options) {
    const objectKey = this._key(key);
    const opts = options || {};
    const range = (opts.start !== undefined && opts.end !== undefined)
      ? `bytes=${opts.start}-${opts.end}`
      : undefined;
    const result = await this.client.getStream(objectKey, { range });
    return result.stream;
  }

  async getSignedUrl(key, options) {
    const objectKey = this._key(key);
    const expires = (options && options.expires) || 3600;
    const url = this.client.signatureUrl(objectKey, { expires });
    if (this.cdnDomain) {
      const parsed = new URL(url);
      return url.replace(parsed.origin, `https://${this.cdnDomain}`);
    }
    return url;
  }

  async delete(key) {
    const objectKey = this._key(key);
    await this.client.delete(objectKey);
  }

  async getMetadata(key) {
    const objectKey = this._key(key);
    try {
      const result = await this.client.head(objectKey);
      return {
        key: objectKey,
        size: parseInt(result.res.headers['content-length'], 10) || 0,
        mimetype: result.res.headers['content-type'] || 'application/octet-stream',
        lastModified: result.res.headers['last-modified'],
      };
    } catch (err) {
      if (err.code === 'NoSuchKey') return null;
      throw err;
    }
  }

  async exists(key) {
    const meta = await this.getMetadata(key);
    return meta !== null;
  }

  async initiateMultipartUpload(key, mimetype) {
    const objectKey = this._key(key);
    const result = await this.client.initMultipartUpload(objectKey, {
      mime: mimetype,
    });
    return { uploadId: result.uploadId, key: objectKey };
  }

  async uploadPart(uploadId, key, partNumber, buffer) {
    const objectKey = this._key(key);
    const result = await this.client.uploadPart(objectKey, uploadId, partNumber, buffer);
    return { partNumber, etag: result.etag };
  }

  async completeMultipartUpload(uploadId, key, parts) {
    const objectKey = this._key(key);
    const doneParts = parts.map(function (p) {
      return { number: p.partNumber, etag: p.etag };
    });
    await this.client.completeMultipartUpload(objectKey, uploadId, doneParts);
    return { key: objectKey };
  }

  async abortMultipartUpload(uploadId, key) {
    const objectKey = this._key(key);
    await this.client.abortMultipartUpload(objectKey, uploadId);
  }

  getPublicUrl(key) {
    const objectKey = this._key(key);
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${objectKey}`;
    }
    return `https://${this.bucket}.${this.region}.aliyuncs.com/${objectKey}`;
  }
}

module.exports = OssStorageProvider;
