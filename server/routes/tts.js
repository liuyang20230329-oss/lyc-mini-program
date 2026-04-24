const express = require('express');
const { authenticateAdmin, authenticateToken } = require('../middleware/auth');
const ttsService = require('../services/ai/tts-service');
const db = require('../config/database');

const router = express.Router();

router.get('/voices', async function (_req, res) {
  var voices = ttsService.getVoices();
  res.json({ voices: voices });
});

router.post('/preview', authenticateToken, async function (req, res) {
  var text = req.body.text || '你好呀，我是小宇宙学堂的小伙伴，快来和我一起学习吧！';
  var voiceId = req.body.voiceId || 'xiaoyue';
  var result = await ttsService.synthesize(text, voiceId);
  if (!result.ok) {
    res.status(500).json({ error: result.error });
    return;
  }
  res.setHeader('Content-Type', result.contentType || 'audio/mp3');
  res.setHeader('Content-Length', result.audio.length);
  res.send(result.audio);
});

router.post('/synthesize', authenticateAdmin, async function (req, res) {
  var text = req.body.text;
  var voiceId = req.body.voiceId || 'xiaoyue';
  var courseId = req.body.courseId || 'preview';
  var segmentIndex = req.body.segmentIndex || 0;
  if (!text) { res.status(400).json({ error: '文本不能为空' }); return; }

  var cached = await ttsService.getCached(text, voiceId);
  if (cached.cached) {
    res.json({ ok: true, url: cached.url, durationMs: cached.durationMs, cached: true });
    return;
  }

  var result = await ttsService.synthesizeAndSave(text, voiceId, courseId, segmentIndex);
  if (!result.ok) {
    res.status(500).json({ error: result.error });
    return;
  }
  res.json({ ok: true, url: result.url, durationMs: result.durationMs, isDev: result.isDev });
});

router.post('/synthesize-course/:courseId', authenticateAdmin, async function (req, res) {
  var courseId = req.params.courseId;
  var voiceId = req.body.voiceId || 'xiaoyue';
  var result = await ttsService.synthesizeCourseSegments(courseId, voiceId);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.get('/cache/:courseId', authenticateAdmin, async function (req, res) {
  var courseId = req.params.courseId;
  var rows = await db.all('SELECT * FROM tts_cache WHERE course_id = ? ORDER BY segment_index', [courseId]);
  res.json({ items: rows });
});

router.delete('/cache/:cacheId', authenticateAdmin, async function (req, res) {
  var row = await db.get('SELECT * FROM tts_cache WHERE id = ?', [req.params.cacheId]);
  if (!row) { res.status(404).json({ error: '缓存不存在' }); return; }
  try {
    var { storage } = require('../services/storage');
    await storage.delete(row.storage_key);
  } catch (_) {}
  await db.run('DELETE FROM tts_cache WHERE id = ?', [req.params.cacheId]);
  res.json({ success: true });
});

module.exports = router;
