const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const { storage, STORAGE_MODE } = require('../services/storage');
const db = require('../config/database');

const router = express.Router();

const tmpDir = path.join(__dirname, '..', 'data', 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const tmpStorage = multer.diskStorage({
  destination: function (_req, _file, cb) { cb(null, tmpDir); },
  filename: function (_req, file, cb) { cb(null, 'tmp-' + uuidv4() + path.extname(file.originalname)); },
});

const upload = multer({
  storage: tmpStorage,
  limits: { fileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE, 10) || 209715200 },
});

function mediaKey(courseId, fileType, filename) {
  const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  return 'media/' + fileType + '/' + courseId + '/' + datePath + '/' + filename;
}

function cleanupTmp(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
}

async function saveFileRecord(record) {
  await db.run(
    'INSERT INTO media_files (id, course_id, storage_key, original_name, mimetype, size, file_type, storage_mode, upload_type, status, duration_ms, metadata_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [record.id, record.courseId, record.storageKey, record.originalName, record.mimetype, record.size, record.fileType, record.storageMode, record.uploadType, record.status || 'ready', record.durationMs || null, record.metadataJson || null, record.createdAt, record.updatedAt]
  );
}

router.post('/single', authenticateAdmin, upload.single('file'), async function (req, res) {
  if (!req.file) { res.status(400).json({ error: '没有接收到文件。' }); return; }
  var courseId = req.body.courseId || 'unassigned';
  var fileType = req.body.fileType || 'audio';
  var key = mediaKey(courseId, fileType, req.file.filename);
  var now = new Date().toISOString();
  try {
    var result = await storage.saveFromFile(req.file.path, key, req.file.mimetype);
    cleanupTmp(req.file.path);
    var record = {
      id: uuidv4(), courseId: courseId, storageKey: key,
      originalName: req.file.originalname, mimetype: req.file.mimetype,
      size: result.size || req.file.size, fileType: fileType,
      storageMode: STORAGE_MODE, uploadType: 'single', status: 'ready',
      createdAt: now, updatedAt: now,
    };
    await saveFileRecord(record);
    res.json({ file: formatFile(record) });
  } catch (err) {
    cleanupTmp(req.file.path);
    res.status(500).json({ error: '文件存储失败。' });
  }
});

router.post('/init', authenticateAdmin, async function (req, res) {
  var body = req.body;
  if (!body.filename || !body.mimetype || !body.totalChunks) {
    res.status(400).json({ error: '缺少分片上传必要参数。' }); return;
  }
  var courseId = body.courseId || 'unassigned';
  var fileType = body.fileType || 'audio';
  var key = mediaKey(courseId, fileType, uuidv4() + '/' + body.filename);
  var now = new Date().toISOString();
  try {
    var initResult = await storage.initiateMultipartUpload(key, body.mimetype);
    var sessionId = uuidv4();
    await db.run(
      'INSERT INTO upload_sessions (id, course_id, storage_key, upload_id, original_name, mimetype, total_size, total_chunks, received_chunks, file_type, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [sessionId, courseId, key, initResult.uploadId, body.filename, body.mimetype, body.totalSize || 0, body.totalChunks, 0, fileType, 'uploading', now, now]
    );
    var chunkSize = parseInt(process.env.UPLOAD_CHUNK_SIZE, 10) || 5242880;
    res.json({ sessionId: sessionId, uploadId: initResult.uploadId, key: key, chunkSize: chunkSize });
  } catch (err) {
    res.status(500).json({ error: '分片上传初始化失败。' });
  }
});

router.post('/chunk', authenticateAdmin, upload.single('chunk'), async function (req, res) {
  var sessionId = req.body.sessionId;
  var partNumber = req.body.partNumber;
  if (!sessionId || !partNumber || !req.file) {
    cleanupTmp(req.file && req.file.path);
    res.status(400).json({ error: '缺少分片参数。' }); return;
  }
  var session = await db.get('SELECT * FROM upload_sessions WHERE id = ?', [sessionId]);
  if (!session || session.status !== 'uploading') {
    cleanupTmp(req.file.path);
    res.status(404).json({ error: '上传会话不存在或已结束。' }); return;
  }
  try {
    var buffer = fs.readFileSync(req.file.path);
    var partResult = await storage.uploadPart(session.upload_id, session.storage_key, Number(partNumber), buffer);
    cleanupTmp(req.file.path);
    var newReceived = session.received_chunks + 1;
    await db.run('UPDATE upload_sessions SET received_chunks = ?, updated_at = ? WHERE id = ?', [newReceived, new Date().toISOString(), sessionId]);
    res.json({ partNumber: Number(partNumber), etag: partResult.etag, receivedChunks: newReceived, totalChunks: session.total_chunks });
  } catch (err) {
    cleanupTmp(req.file.path);
    res.status(500).json({ error: '分片上传失败。' });
  }
});

router.post('/complete', authenticateAdmin, async function (req, res) {
  var sessionId = req.body.sessionId;
  var parts = req.body.parts;
  if (!sessionId || !Array.isArray(parts)) { res.status(400).json({ error: '缺少合并参数。' }); return; }
  var session = await db.get('SELECT * FROM upload_sessions WHERE id = ?', [sessionId]);
  if (!session || session.status !== 'uploading') { res.status(404).json({ error: '会话不存在。' }); return; }
  if (session.received_chunks < session.total_chunks) {
    res.status(400).json({ error: '还有 ' + (session.total_chunks - session.received_chunks) + ' 个分片未上传。' }); return;
  }
  try {
    await storage.completeMultipartUpload(session.upload_id, session.storage_key, parts);
    var now = new Date().toISOString();
    await db.run("UPDATE upload_sessions SET status = 'completed', updated_at = ? WHERE id = ?", [now, sessionId]);
    var meta = await storage.getMetadata(session.storage_key);
    var record = {
      id: uuidv4(), courseId: session.course_id, storageKey: session.storage_key,
      originalName: session.original_name, mimetype: session.mimetype,
      size: (meta && meta.size) || session.total_size, fileType: session.file_type,
      storageMode: STORAGE_MODE, uploadType: 'chunked', status: 'ready',
      createdAt: now, updatedAt: now,
    };
    await saveFileRecord(record);
    res.json({ file: formatFile(record) });
  } catch (err) {
    res.status(500).json({ error: '分片合并失败。' });
  }
});

router.post('/abort', authenticateAdmin, async function (req, res) {
  var sessionId = req.body.sessionId;
  if (!sessionId) { res.status(400).json({ error: '缺少会话 ID。' }); return; }
  var session = await db.get('SELECT * FROM upload_sessions WHERE id = ?', [sessionId]);
  if (!session) { res.status(404).json({ error: '会话不存在。' }); return; }
  try {
    await storage.abortMultipartUpload(session.upload_id, session.storage_key);
    await db.run("UPDATE upload_sessions SET status = 'aborted', updated_at = ? WHERE id = ?", [new Date().toISOString(), sessionId]);
    res.json({ success: true });
  } catch (_) {
    res.status(500).json({ error: '取消失败。' });
  }
});

router.delete('/:fileId', authenticateAdmin, async function (req, res) {
  var row = await db.get('SELECT * FROM media_files WHERE id = ?', [req.params.fileId]);
  if (!row) { res.status(404).json({ error: '未找到文件。' }); return; }
  try { await storage.delete(row.storage_key); } catch (_) {}
  await db.run("UPDATE media_files SET status = 'deleted', updated_at = ? WHERE id = ?", [new Date().toISOString(), req.params.fileId]);
  res.json({ success: true });
});

function formatFile(record) {
  return {
    id: record.id, originalName: record.originalName, mimetype: record.mimetype,
    size: record.size, fileType: record.fileType, status: record.status,
    url: storage.getPublicUrl(record.storageKey), createdAt: record.createdAt,
  };
}

module.exports = router;
