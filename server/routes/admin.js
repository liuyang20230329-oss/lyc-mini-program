const express = require('express');
const path = require('path');
const db = require('../config/database');

const router = express.Router();

router.get('/stats', async function (_req, res) {
  var categories = await db.get("SELECT COUNT(*) AS count FROM categories WHERE status = 'active'");
  var courses = await db.get("SELECT COUNT(*) AS count FROM courses WHERE status = 'active'");
  var segments = await db.get("SELECT COUNT(*) AS count FROM course_segments");
  var mediaFiles = await db.get("SELECT COUNT(*) AS count FROM media_files WHERE status = 'ready'");
  var users = await db.get("SELECT COUNT(*) AS count FROM users WHERE status = 'active'");
  var ttsCache = await db.get("SELECT COUNT(*) AS count FROM tts_cache WHERE status = 'ready'");

  res.json({
    categories: categories.count,
    courses: courses.count,
    segments: segments.count,
    mediaFiles: mediaFiles.count,
    users: users.count,
    ttsCache: ttsCache.count,
  });
});

router.get('/media-files', async function (req, res) {
  var page = Math.max(1, parseInt(req.query.page, 10) || 1);
  var pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
  var offset = (page - 1) * pageSize;
  var fileType = req.query.fileType;

  var countSql = "SELECT COUNT(*) AS total FROM media_files WHERE status != 'deleted'";
  var listSql = "SELECT * FROM media_files WHERE status != 'deleted'";
  var params = [];

  if (fileType) {
    countSql += ' AND file_type = ?';
    listSql += ' AND file_type = ?';
    params.push(fileType);
  }

  listSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  var countResult = await db.get(countSql, params);
  var rows = await db.all(listSql, params.concat([pageSize, offset]));
  res.json({ total: countResult.total, page: page, pageSize: pageSize, items: rows });
});

module.exports = router;
