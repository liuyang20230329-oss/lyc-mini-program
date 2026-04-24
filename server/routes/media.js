const express = require('express');
const fs = require('fs');
const { storage, STORAGE_MODE } = require('../services/storage');
const db = require('../config/database');

const router = express.Router();

router.get('/stream/:key', async function (req, res) {
  var key = decodeURIComponent(req.params.key);
  var row = await db.get("SELECT * FROM media_files WHERE storage_key = ? AND status != 'deleted'", [key]);
  if (!row) { res.status(404).json({ error: '未找到该文件。' }); return; }

  if (STORAGE_MODE === 'oss') {
    var signedUrl = await storage.getSignedUrl(key, { expires: 300 });
    res.redirect(signedUrl);
    return;
  }

  var stream = await storage.getReadStream(key);
  if (!stream || !stream.path || !fs.existsSync(stream.path)) {
    res.status(404).json({ error: '文件不存在。' }); return;
  }

  var stat = fs.statSync(stream.path);
  var fileSize = stat.size;
  var mimetype = row.mimetype || 'application/octet-stream';
  var range = req.headers.range;

  if (range) {
    var parts = range.replace(/bytes=/, '').split('-');
    var start = parseInt(parts[0], 10);
    var end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (start >= fileSize) {
      res.status(416).setHeader('Content-Range', 'bytes */' + fileSize);
      res.end(); return;
    }
    var chunkSize = end - start + 1;
    var fileStream = fs.createReadStream(stream.path, { start: start, end: end });
    res.writeHead(206, {
      'Content-Range': 'bytes ' + start + '-' + end + '/' + fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimetype,
      'Cache-Control': 'public, max-age=86400',
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimetype,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    });
    fs.createReadStream(stream.path).pipe(res);
  }
});

router.get('/info/:fileId', async function (req, res) {
  var row = await db.get("SELECT * FROM media_files WHERE id = ? AND status != 'deleted'", [req.params.fileId]);
  if (!row) { res.status(404).json({ error: '未找到文件。' }); return; }
  var meta = await storage.getMetadata(row.storage_key);
  res.json({
    id: row.id, originalName: row.original_name, mimetype: row.mimetype,
    size: (meta && meta.size) || row.size, fileType: row.file_type,
    publicUrl: storage.getPublicUrl(row.storage_key),
    createdAt: row.created_at,
  });
});

router.get('/signed-url/:fileId', async function (req, res) {
  var row = await db.get("SELECT * FROM media_files WHERE id = ? AND status != 'deleted'", [req.params.fileId]);
  if (!row) { res.status(404).json({ error: '未找到文件。' }); return; }
  var expires = parseInt(req.query.expires, 10) || 3600;
  var signedUrl = await storage.getSignedUrl(row.storage_key, { expires: expires });
  res.json({ url: signedUrl, expires: expires });
});

module.exports = router;
