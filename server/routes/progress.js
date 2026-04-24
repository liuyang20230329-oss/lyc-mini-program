const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

router.post('/sync', authenticateToken, async function (req, res) {
  var body = req.body;
  var openid = req.auth.openid;
  var courseId = body.courseId;
  if (!openid || !courseId) { res.status(400).json({ error: '参数不完整。' }); return; }
  var now = new Date().toISOString();
  var existing = await db.get('SELECT * FROM user_progress WHERE user_openid = ? AND course_id = ?', [openid, courseId]);
  if (existing) {
    var fields = [];
    var params = [];
    if (body.currentSegmentIndex !== undefined) { fields.push('current_segment_index = ?'); params.push(body.currentSegmentIndex); }
    if (body.lastPositionMs !== undefined) { fields.push('last_position_ms = ?'); params.push(body.lastPositionMs); }
    if (body.playCount !== undefined) { fields.push('play_count = ?'); params.push(body.playCount); }
    if (body.completedSegments !== undefined) { fields.push('completed_segments = ?'); params.push(JSON.stringify(body.completedSegments)); }
    if (body.totalPlayMs !== undefined) { fields.push('total_play_ms = ?'); params.push(body.totalPlayMs); }
    if (fields.length > 0) {
      fields.push('updated_at = ?');
      params.push(now);
      params.push(openid);
      params.push(courseId);
      await db.run('UPDATE user_progress SET ' + fields.join(', ') + ' WHERE user_openid = ? AND course_id = ?', params);
    }
  } else {
    var { v4: uuidv4 } = require('uuid');
    await db.run(
      'INSERT INTO user_progress (id, user_openid, course_id, current_segment_index, last_position_ms, play_count, completed_segments, total_play_ms, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), openid, courseId, body.currentSegmentIndex || 0, body.lastPositionMs || 0, body.playCount || 0, JSON.stringify(body.completedSegments || []), body.totalPlayMs || 0, now, now]
    );
  }
  var row = await db.get('SELECT * FROM user_progress WHERE user_openid = ? AND course_id = ?', [openid, courseId]);
  res.json({ progress: formatProgress(row) });
});

router.get('/:courseId', authenticateToken, async function (req, res) {
  var openid = req.auth.openid;
  var row = await db.get('SELECT * FROM user_progress WHERE user_openid = ? AND course_id = ?', [openid, req.params.courseId]);
  if (!row) { res.json({ progress: null }); return; }
  res.json({ progress: formatProgress(row) });
});

router.get('/', authenticateToken, async function (req, res) {
  var openid = req.auth.openid;
  var rows = await db.all('SELECT * FROM user_progress WHERE user_openid = ?', [openid]);
  res.json({ items: rows.map(formatProgress) });
});

function formatProgress(row) {
  return {
    courseId: row.course_id, currentSegmentIndex: row.current_segment_index,
    lastPositionMs: row.last_position_ms, playCount: row.play_count,
    completedSegments: JSON.parse(row.completed_segments || '[]'),
    totalPlayMs: row.total_play_ms, updatedAt: row.updated_at,
  };
}

module.exports = router;
