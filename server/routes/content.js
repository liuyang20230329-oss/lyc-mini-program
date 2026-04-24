const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateAdmin } = require('../middleware/auth');
const { storage } = require('../services/storage');
const db = require('../config/database');

const router = express.Router();

router.post('/categories', authenticateAdmin, async function (req, res) {
  var body = req.body;
  if (!body.name) { res.status(400).json({ error: '分类名称不能为空。' }); return; }
  var now = new Date().toISOString();
  var id = body.id || uuidv4();
  await db.run(
    'INSERT INTO categories (id, name, subtitle, badge, icon, hero_title, hero_text, tone, sort_order, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, body.name, body.subtitle || null, body.badge || null, body.icon || null, body.heroTitle || null, body.heroText || null, body.tone || 'sky', body.sortOrder || 0, 'active', now, now]
  );
  var row = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
  res.json({ category: formatCategory(row) });
});

router.get('/categories', async function (req, res) {
  var rows = await db.all("SELECT * FROM categories WHERE status = 'active' ORDER BY sort_order, created_at");
  res.json({ items: rows.map(formatCategory) });
});

router.put('/categories/:id', authenticateAdmin, async function (req, res) {
  var body = req.body;
  var now = new Date().toISOString();
  var fields = [];
  var params = [];
  var allowed = ['name', 'subtitle', 'badge', 'icon', 'hero_title', 'hero_text', 'tone', 'sort_order', 'status'];
  allowed.forEach(function (col) {
    var camel = col.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
    if (body[camel] !== undefined) { fields.push(col + ' = ?'); params.push(body[camel]); }
  });
  if (fields.length === 0) { res.status(400).json({ error: '没有需要更新的字段。' }); return; }
  fields.push('updated_at = ?');
  params.push(now);
  params.push(req.params.id);
  await db.run('UPDATE categories SET ' + fields.join(', ') + ' WHERE id = ?', params);
  var row = await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  res.json({ category: formatCategory(row) });
});

router.delete('/categories/:id', authenticateAdmin, async function (req, res) {
  await db.run("UPDATE categories SET status = 'deleted', updated_at = ? WHERE id = ?", [new Date().toISOString(), req.params.id]);
  res.json({ success: true });
});

router.post('/courses', authenticateAdmin, async function (req, res) {
  var body = req.body;
  if (!body.title || !body.categoryId) { res.status(400).json({ error: '课程标题和分类不能为空。' }); return; }
  var now = new Date().toISOString();
  var id = body.id || uuidv4();
  await db.run(
    'INSERT INTO courses (id, category_id, title, subtitle, summary, duration_text, age_range, difficulty, reward, cover_label, mentor, cover_url, audio_url, video_url, audio_storage_key, video_storage_key, status, storage_mode, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, body.categoryId, body.title, body.subtitle || null, body.summary || null, body.durationText || null, body.ageRange || null, body.difficulty || null, body.reward || 0, body.coverLabel || null, body.mentor || null, body.coverUrl || null, body.audioUrl || null, body.videoUrl || null, body.audioStorageKey || null, body.videoStorageKey || null, 'active', body.storageMode || 'local', body.sortOrder || 0, now, now]
  );
  var row = await db.get('SELECT * FROM courses WHERE id = ?', [id]);
  res.json({ course: formatCourse(row) });
});

router.get('/courses', async function (req, res) {
  var categoryId = req.query.categoryId;
  var page = Math.max(1, parseInt(req.query.page, 10) || 1);
  var pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
  var offset = (page - 1) * pageSize;

  var countSql = "SELECT COUNT(*) AS total FROM courses WHERE status = 'active'";
  var listSql = "SELECT * FROM courses WHERE status = 'active'";
  var params = [];

  if (categoryId) {
    countSql += ' AND category_id = ?';
    listSql += ' AND category_id = ?';
    params.push(categoryId);
  }

  listSql += ' ORDER BY sort_order, created_at DESC LIMIT ? OFFSET ?';
  var countResult = await db.get(countSql, params);
  var rows = await db.all(listSql, params.concat([pageSize, offset]));
  res.json({ total: countResult.total, page: page, pageSize: pageSize, items: rows.map(formatCourse) });
});

router.get('/courses/:id', async function (req, res) {
  var course = await db.get("SELECT * FROM courses WHERE id = ? AND status = 'active'", [req.params.id]);
  if (!course) { res.status(404).json({ error: '课程不存在。' }); return; }
  var segments = await db.all('SELECT * FROM course_segments WHERE course_id = ? ORDER BY sort_order, segment_index', [req.params.id]);
  res.json({ course: formatCourse(course), segments: segments.map(formatSegment) });
});

router.put('/courses/:id', authenticateAdmin, async function (req, res) {
  var body = req.body;
  var now = new Date().toISOString();
  var fields = [];
  var params = [];
  var allowed = ['category_id', 'title', 'subtitle', 'summary', 'duration_text', 'age_range', 'difficulty', 'reward', 'cover_label', 'mentor', 'cover_url', 'audio_url', 'video_url', 'audio_storage_key', 'video_storage_key', 'asr_status', 'segment_count', 'total_duration_ms', 'full_text', 'status', 'sort_order'];
  allowed.forEach(function (col) {
    var camel = col.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
    if (body[camel] !== undefined) { fields.push(col + ' = ?'); params.push(body[camel]); }
  });
  if (fields.length === 0) { res.status(400).json({ error: '没有需要更新的字段。' }); return; }
  fields.push('updated_at = ?');
  params.push(now);
  params.push(req.params.id);
  await db.run('UPDATE courses SET ' + fields.join(', ') + ' WHERE id = ?', params);
  var row = await db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  res.json({ course: formatCourse(row) });
});

router.delete('/courses/:id', authenticateAdmin, async function (req, res) {
  await db.run("UPDATE courses SET status = 'deleted', updated_at = ? WHERE id = ?", [new Date().toISOString(), req.params.id]);
  res.json({ success: true });
});

router.post('/courses/:courseId/segments', authenticateAdmin, async function (req, res) {
  var courseId = req.params.courseId;
  var body = req.body;
  var now = new Date().toISOString();
  var id = uuidv4();
  await db.run(
    'INSERT INTO course_segments (id, course_id, segment_index, title, cue, text, translation, tip, start_time_ms, end_time_ms, audio_url, duration_ms, focus_points, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, courseId, body.segmentIndex || 0, body.title || null, body.cue || null, body.text || null, body.translation || null, body.tip || null, body.startTimeMs || 0, body.endTimeMs || 0, body.audioUrl || null, body.durationMs || 0, body.focusPoints || null, body.sortOrder || 0]
  );
  var row = await db.get('SELECT * FROM course_segments WHERE id = ?', [id]);
  res.json({ segment: formatSegment(row) });
});

router.put('/segments/:segmentId', authenticateAdmin, async function (req, res) {
  var body = req.body;
  var fields = [];
  var params = [];
  var allowed = ['segment_index', 'title', 'cue', 'text', 'translation', 'tip', 'start_time_ms', 'end_time_ms', 'audio_url', 'duration_ms', 'focus_points', 'sort_order'];
  allowed.forEach(function (col) {
    var camel = col.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
    if (body[camel] !== undefined) { fields.push(col + ' = ?'); params.push(body[camel]); }
  });
  if (fields.length > 0) {
    fields.push('sort_order = sort_order');
    params.push(req.params.segmentId);
    await db.run('UPDATE course_segments SET ' + fields.join(', ') + ' WHERE id = ?', params);
  }
  var row = await db.get('SELECT * FROM course_segments WHERE id = ?', [req.params.segmentId]);
  res.json({ segment: formatSegment(row) });
});

router.delete('/segments/:segmentId', authenticateAdmin, async function (req, res) {
  await db.run('DELETE FROM course_segments WHERE id = ?', [req.params.segmentId]);
  res.json({ success: true });
});

function formatCategory(row) {
  return {
    id: row.id, name: row.name, subtitle: row.subtitle, badge: row.badge,
    icon: row.icon, heroTitle: row.hero_title, heroText: row.hero_text,
    tone: row.tone, sortOrder: row.sort_order, status: row.status,
    createdAt: row.created_at,
  };
}

function formatCourse(row) {
  return {
    id: row.id, categoryId: row.category_id, title: row.title, subtitle: row.subtitle,
    summary: row.summary, durationText: row.duration_text, ageRange: row.age_range,
    difficulty: row.difficulty, reward: row.reward, coverLabel: row.cover_label,
    mentor: row.mentor, coverUrl: row.cover_url,
    audioUrl: row.audio_url || (row.audio_storage_key ? storage.getPublicUrl(row.audio_storage_key) : null),
    videoUrl: row.video_url || (row.video_storage_key ? storage.getPublicUrl(row.video_storage_key) : null),
    totalDurationMs: row.total_duration_ms, fullText: row.full_text,
    asrStatus: row.asr_status, segmentCount: row.segment_count,
    status: row.status, sortOrder: row.sort_order, createdAt: row.created_at,
  };
}

function formatSegment(row) {
  return {
    id: row.id, courseId: row.course_id, segmentIndex: row.segment_index,
    title: row.title, cue: row.cue, text: row.text, translation: row.translation,
    tip: row.tip, startTimeMs: row.start_time_ms, endTimeMs: row.end_time_ms,
    audioUrl: row.audio_url, durationMs: row.duration_ms,
    focusPoints: row.focus_points, sortOrder: row.sort_order,
  };
}

module.exports = router;
