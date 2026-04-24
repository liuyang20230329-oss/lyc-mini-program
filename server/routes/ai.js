const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateAdmin } = require('../middleware/auth');
const { storage, STORAGE_MODE } = require('../services/storage');
const asrService = require('../services/ai/asr-service');
const segmenter = require('../services/ai/segmenter');
const db = require('../config/database');

const router = express.Router();

var analysisTasks = {};

router.post('/analyze/:courseId', authenticateAdmin, async function (req, res) {
  var courseId = req.params.courseId;
  var course = await db.get("SELECT * FROM courses WHERE id = ?", [courseId]);
  if (!course) { res.status(404).json({ error: '课程不存在。' }); return; }

  if (analysisTasks[courseId] && analysisTasks[courseId].status === 'processing') {
    res.json({ status: 'processing', message: '正在分析中，请稍后查询。', taskId: analysisTasks[courseId].taskId });
    return;
  }

  var audioKey = course.audio_storage_key;
  if (!audioKey) { res.status(400).json({ error: '课程没有关联的音频文件。' }); return; }

  var audioUrl;
  if (STORAGE_MODE === 'oss') {
    audioUrl = await storage.getSignedUrl(audioKey, { expires: 7200 });
  } else {
    var baseUrl = req.protocol + '://' + req.get('host');
    audioUrl = baseUrl + '/api/v1/media/stream/' + encodeURIComponent(audioKey);
  }

  var taskId = uuidv4();

  if (asrService.isConfigured()) {
    try {
      var asrResult = await asrService.startRecognition(audioUrl, {
        languageHint: req.body.languageHint || 'zh',
      });
      taskId = asrResult.taskId || taskId;
    } catch (err) {
      res.status(500).json({ error: 'ASR 提交失败: ' + err.message });
      return;
    }
  }

  analysisTasks[courseId] = {
    taskId: taskId,
    status: 'processing',
    progress: 0,
    asrConfigured: asrService.isConfigured(),
    manualSentences: req.body.sentences || null,
    options: req.body.options || {},
    startedAt: Date.now(),
  };

  await db.run("UPDATE courses SET asr_status = 'processing', updated_at = ? WHERE id = ?", [new Date().toISOString(), courseId]);

  if (!asrService.isConfigured() && analysisTasks[courseId].manualSentences) {
    processWithLocalData(courseId);
  }

  res.json({ status: 'processing', taskId: taskId, courseId: courseId, asrConfigured: asrService.isConfigured() });
});

router.get('/status/:courseId', async function (req, res) {
  var courseId = req.params.courseId;
  var task = analysisTasks[courseId];

  if (!task) {
    var course = await db.get('SELECT asr_status FROM courses WHERE id = ?', [courseId]);
    if (course && course.asr_status === 'done') {
      res.json({ status: 'completed', courseId: courseId });
    } else {
      res.json({ status: 'none', courseId: courseId });
    }
    return;
  }

  if (task.status !== 'processing') {
    res.json({ status: task.status, taskId: task.taskId, courseId: courseId, progress: 100, message: task.message || '' });
    return;
  }

  if (task.asrConfigured) {
    try {
      var asrResult = await asrService.getRecognitionResult(task.taskId);
      if (asrResult.status === 'completed') {
        task.sentences = asrResult.sentences;
        task.fullText = asrResult.fullText;
        await runSegmentation(courseId, task);
        res.json({ status: 'completed', taskId: task.taskId, courseId: courseId, progress: 100, segmentCount: task.segmentCount });
        return;
      }
      if (asrResult.status === 'error') {
        task.status = 'error';
        task.message = asrResult.message;
        await db.run("UPDATE courses SET asr_status = 'failed', updated_at = ? WHERE id = ?", [new Date().toISOString(), courseId]);
        res.json({ status: 'error', taskId: task.taskId, courseId: courseId, message: asrResult.message });
        return;
      }
      task.progress = asrResult.progress || 50;
    } catch (err) {
      task.status = 'error';
      task.message = err.message;
    }
  }

  res.json({ status: task.status, taskId: task.taskId, courseId: courseId, progress: task.progress || 0 });
});

router.put('/segments/:courseId', authenticateAdmin, async function (req, res) {
  var courseId = req.params.courseId;
  var segments = req.body.segments;
  if (!Array.isArray(segments)) { res.status(400).json({ error: 'segments 必须是数组。' }); return; }

  await db.run('DELETE FROM course_segments WHERE course_id = ?', [courseId]);

  var count = 0;
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var now = new Date().toISOString();
    var id = seg.id || uuidv4();
    await db.run(
      'INSERT INTO course_segments (id, course_id, segment_index, title, cue, text, translation, tip, start_time_ms, end_time_ms, duration_ms, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, courseId, i, seg.title || null, seg.cue || '段落 ' + (i + 1), seg.text || '', seg.translation || '', seg.tip || '', seg.startTimeMs || 0, seg.endTimeMs || 0, (seg.endTimeMs || 0) - (seg.startTimeMs || 0), i]
    );
    count++;
  }

  var now = new Date().toISOString();
  await db.run('UPDATE courses SET segment_count = ?, asr_status = ?, full_text = ?, updated_at = ? WHERE id = ?', [count, 'done', req.body.fullText || '', now, courseId]);

  res.json({ success: true, courseId: courseId, segmentCount: count });
});

async function runSegmentation(courseId, task) {
  var sentences = task.sentences || [];
  var options = task.options || {};

  var segments = await segmenter.segmentByText(sentences, {
    minSegmentDuration: options.minSegmentDuration || 5,
    maxSegmentDuration: options.maxSegmentDuration || 30,
    targetSegmentCount: options.targetSegmentCount,
  });

  await db.run('DELETE FROM course_segments WHERE course_id = ?', [courseId]);

  var count = 0;
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var now = new Date().toISOString();
    var cueText = seg.sentences && seg.sentences.length > 0 ? seg.sentences[0].text : '';
    await db.run(
      'INSERT INTO course_segments (id, course_id, segment_index, title, cue, text, start_time_ms, end_time_ms, duration_ms, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), courseId, i, seg.title, '段落 ' + (i + 1), seg.text, seg.startTimeMs, seg.endTimeMs, seg.durationMs, i]
    );
    count++;
  }

  var now2 = new Date().toISOString();
  await db.run('UPDATE courses SET asr_status = ?, segment_count = ?, total_duration_ms = ?, full_text = ?, updated_at = ? WHERE id = ?',
    ['done', count, segments.length > 0 ? segments[segments.length - 1].endTimeMs : 0, task.fullText || '', now2, courseId]);

  task.status = 'completed';
  task.segmentCount = count;
}

async function processWithLocalData(courseId) {
  var task = analysisTasks[courseId];
  if (!task || !task.manualSentences) return;

  var sentences = asrService.extractSentencesFromLocalData(task.manualSentences);
  task.sentences = sentences;
  task.fullText = sentences.map(function (s) { return s.text; }).join('');

  try {
    await runSegmentation(courseId, task);
  } catch (err) {
    task.status = 'error';
    task.message = err.message;
  }
}

module.exports = router;
