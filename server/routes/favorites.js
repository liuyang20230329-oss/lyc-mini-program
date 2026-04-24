const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

router.post('/:courseId', authenticateToken, async function (req, res) {
  var openid = req.auth.openid;
  var courseId = req.params.courseId;
  var now = new Date().toISOString();
  var existing = await db.get('SELECT id FROM user_favorites WHERE user_openid = ? AND course_id = ?', [openid, courseId]);
  if (existing) { res.json({ favorited: true }); return; }
  await db.run('INSERT INTO user_favorites (id, user_openid, course_id, created_at) VALUES (?,?,?,?)', [uuidv4(), openid, courseId, now]);
  res.json({ favorited: true });
});

router.delete('/:courseId', authenticateToken, async function (req, res) {
  await db.run('DELETE FROM user_favorites WHERE user_openid = ? AND course_id = ?', [req.auth.openid, req.params.courseId]);
  res.json({ favorited: false });
});

router.get('/', authenticateToken, async function (req, res) {
  var rows = await db.all('SELECT course_id, created_at FROM user_favorites WHERE user_openid = ? ORDER BY created_at DESC', [req.auth.openid]);
  res.json({ items: rows.map(function (r) { return { courseId: r.course_id, createdAt: r.created_at }; }) });
});

module.exports = router;
