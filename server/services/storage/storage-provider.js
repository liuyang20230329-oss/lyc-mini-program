class StorageProvider {
  async save(buffer, key, mimetype) { throw new Error('not implemented'); }
  async saveFromFile(filePath, key, mimetype) { throw new Error('not implemented'); }
  async getReadStream(key, options) { throw new Error('not implemented'); }
  async getSignedUrl(key, options) { throw new Error('not implemented'); }
  async delete(key) { throw new Error('not implemented'); }
  async getMetadata(key) { throw new Error('not implemented'); }
  async exists(key) { throw new Error('not implemented'); }
  async initiateMultipartUpload(key, mimetype) { throw new Error('not implemented'); }
  async uploadPart(uploadId, key, partNumber, buffer) { throw new Error('not implemented'); }
  async completeMultipartUpload(uploadId, key, parts) { throw new Error('not implemented'); }
  async abortMultipartUpload(uploadId, key) { throw new Error('not implemented'); }
  getPublicUrl(key) { throw new Error('not implemented'); }
}

module.exports = StorageProvider;
