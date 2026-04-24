const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StorageProvider = require('./storage-provider');

class LocalStorageProvider extends StorageProvider {
  constructor(baseDir) {
    super();
    this.baseDir = baseDir;
    this.multipartSessions = new Map();
    fs.mkdirSync(baseDir, { recursive: true });
    fs.mkdirSync(path.join(baseDir, '.multipart'), { recursive: true });
  }

  _resolve(key) {
    const fullPath = path.join(this.baseDir, key);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(this.baseDir))) {
      throw new Error('invalid key');
    }
    return resolved;
  }

  async save(buffer, key, mimetype) {
    const filePath = this._resolve(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    return { key, size: buffer.length, mimetype };
  }

  async saveFromFile(sourcePath, key, mimetype) {
    const filePath = this._resolve(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.copyFileSync(sourcePath, filePath);
    const stat = fs.statSync(filePath);
    return { key, size: stat.size, mimetype };
  }

  async getReadStream(key, options) {
    const filePath = this._resolve(key);
    if (!fs.existsSync(filePath)) return null;
    const opts = options || {};
    return fs.createReadStream(filePath, { start: opts.start, end: opts.end });
  }

  async getSignedUrl(key, options) {
    const baseUrl = (options && options.baseUrl) || 'http://127.0.0.1:3002';
    const expires = (options && options.expires) || 3600;
    const sig = crypto.createHmac('sha256', 'lyc-dev-key').update(key + expires).digest('hex').substring(0, 16);
    return `${baseUrl}/api/v1/media/stream/${encodeURIComponent(key)}?sig=${sig}&exp=${Math.floor(Date.now() / 1000) + expires}`;
  }

  async delete(key) {
    const filePath = this._resolve(key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async getMetadata(key) {
    const filePath = this._resolve(key);
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.wav': 'audio/wav' };
    return { key, size: stat.size, mimetype: mimeMap[ext] || 'application/octet-stream', lastModified: stat.mtime.toISOString() };
  }

  async exists(key) {
    return fs.existsSync(this._resolve(key));
  }

  async initiateMultipartUpload(key, mimetype) {
    const uploadId = crypto.randomUUID();
    const sessionDir = path.join(this.baseDir, '.multipart', uploadId);
    fs.mkdirSync(sessionDir, { recursive: true });
    this.multipartSessions.set(uploadId, { key, mimetype, parts: [] });
    return { uploadId, key };
  }

  async uploadPart(uploadId, key, partNumber, buffer) {
    const session = this.multipartSessions.get(uploadId);
    if (!session) throw new Error('session not found');
    const sessionDir = path.join(this.baseDir, '.multipart', uploadId);
    const partPath = path.join(sessionDir, `part-${String(partNumber).padStart(5, '0')}`);
    fs.writeFileSync(partPath, buffer);
    const etag = crypto.createHash('md5').update(buffer).digest('hex');
    session.parts.push({ partNumber, path: partPath, size: buffer.length, etag });
    return { partNumber, etag };
  }

  async completeMultipartUpload(uploadId, key, parts) {
    const session = this.multipartSessions.get(uploadId);
    if (!session) throw new Error('session not found');
    const filePath = this._resolve(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const ws = fs.createWriteStream(filePath);
    const sorted = [...session.parts].sort((a, b) => a.partNumber - b.partNumber);
    for (const part of sorted) { ws.write(fs.readFileSync(part.path)); }
    ws.end();
    const sessionDir = path.join(this.baseDir, '.multipart', uploadId);
    fs.rmSync(sessionDir, { recursive: true, force: true });
    this.multipartSessions.delete(uploadId);
    const stat = fs.statSync(filePath);
    return { key, size: stat.size };
  }

  async abortMultipartUpload(uploadId, key) {
    const sessionDir = path.join(this.baseDir, '.multipart', uploadId);
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
    this.multipartSessions.delete(uploadId);
  }

  getPublicUrl(key) {
    return `/api/v1/media/stream/${encodeURIComponent(key)}`;
  }
}

module.exports = LocalStorageProvider;
