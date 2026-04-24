const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { storage, STORAGE_MODE } = require('../storage');
const db = require('../../config/database');

var ACCESS_KEY = process.env.ALIYUN_TTS_ACCESS_KEY || process.env.ALIYUN_ASR_ACCESS_KEY || '';
var ACCESS_SECRET = process.env.ALIYUN_TTS_ACCESS_SECRET || process.env.ALIYUN_ASR_ACCESS_SECRET || '';
var APP_KEY = process.env.ALIYUN_TTS_APP_KEY || process.env.ALIYUN_ASR_APP_KEY || '';
var TTS_DEV_MODE = (process.env.TTS_DEV_MODE || 'true') === 'true';

var VOICE_LIST = [
  { id: 'xiaoyue', name: '小月', desc: '甜美女童', avatar: '🌙', gender: 'female', ageGroup: 'child' },
  { id: 'xiaobei', name: '小北', desc: '活泼男童', avatar: '🌟', gender: 'male', ageGroup: 'child' },
  { id: 'xiaomei', name: '小美', desc: '温柔姐姐', avatar: '🌸', gender: 'female', ageGroup: 'young' },
  { id: 'aitong', name: '艾童', desc: '标准童声', avatar: '🎀', gender: 'female', ageGroup: 'child' },
  { id: 'xiaoyun', name: '小云', desc: '邻家男孩', avatar: '☁', gender: 'male', ageGroup: 'child' },
  { id: 'siyue', name: '思悦', desc: '知性姐姐', avatar: '📖', gender: 'female', ageGroup: 'young' },
  { id: 'aimei', name: '艾美', desc: '活力少女', avatar: '🎵', gender: 'female', ageGroup: 'young' },
  { id: 'aiqi', name: '艾琪', desc: '温柔少女', avatar: '🌺', gender: 'female', ageGroup: 'young' },
];

function isConfigured() {
  return TTS_DEV_MODE || (APP_KEY.length > 0 && ACCESS_KEY.length > 0 && ACCESS_SECRET.length > 0);
}

function getVoices() {
  return VOICE_LIST.map(function (v) {
    return { id: v.id, name: v.name, desc: v.desc, avatar: v.avatar, gender: v.gender, ageGroup: v.ageGroup };
  });
}

function getVoice(id) {
  return VOICE_LIST.find(function (v) { return v.id === id; }) || VOICE_LIST[0];
}

function _token() {
  var time = Math.floor(Date.now() / 1000);
  var expire = time + 3600;
  var payload = {
    access_key_id: ACCESS_KEY,
    action: 'create_token',
    exp: expire,
    iat: time,
  };
  var header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64url');
  var body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  var sig = crypto.createHmac('sha256', ACCESS_SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

function _ttsRequest(text, voiceId, options) {
  return new Promise(function (resolve, reject) {
    var opts = options || {};
    var token = _token();
    var requestBody = JSON.stringify({
      appkey: APP_KEY,
      token: token,
      text: text,
      format: opts.format || 'mp3',
      sample_rate: opts.sampleRate || 16000,
      voice: voiceId || 'xiaoyue',
      volume: opts.volume || 50,
      speech_rate: opts.speechRate || 0,
      pitch_rate: opts.pitchRate || 0,
    });

    var url = new URL('https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts');
    var reqOpts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    };

    var req = https.request(reqOpts, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var buf = Buffer.concat(chunks);
        if (res.statusCode === 200 && buf.length > 1000) {
          resolve({ ok: true, audio: buf, contentType: res.headers['content-type'] || 'audio/mp3' });
        } else {
          try {
            var errBody = JSON.parse(buf.toString('utf-8'));
            resolve({ ok: false, error: errBody.message || 'TTS 合成失败', code: errBody.status || res.statusCode });
          } catch (_) {
            resolve({ ok: false, error: 'TTS 合成失败: HTTP ' + res.statusCode });
          }
        }
      });
    });
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function _generateDevAudio(text, voiceId) {
  var voiceName = getVoice(voiceId).name;
  var meta = {
    dev: true,
    voice: voiceId,
    voiceName: voiceName,
    text: text,
    length: text.length,
    durationMs: Math.max(2000, text.length * 300),
    createdAt: new Date().toISOString(),
  };
  var buf = Buffer.from(JSON.stringify(meta, null, 2));
  return { ok: true, audio: buf, contentType: 'application/json', isDev: true };
}

async function synthesize(text, voiceId, options) {
  if (!text || text.trim().length === 0) {
    return { ok: false, error: '文本内容不能为空' };
  }
  if (text.length > 3000) {
    return { ok: false, error: '单次合成文本不能超过 3000 字符，当前: ' + text.length };
  }

  if (TTS_DEV_MODE) {
    return _generateDevAudio(text, voiceId);
  }

  try {
    return await _ttsRequest(text, voiceId, options);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function synthesizeAndSave(text, voiceId, courseId, segmentIndex, options) {
  var result = await synthesize(text, voiceId, options);
  if (!result.ok) {
    return result;
  }

  var ext = (result.isDev || result.contentType === 'application/json') ? 'json' : 'mp3';
  var key = 'tts/' + courseId + '/' + voiceId + '/seg-' + segmentIndex + '-' + uuidv4().slice(0, 8) + '.' + ext;
  var tmpDir = path.join(__dirname, '..', '..', 'data', 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  var tmpFile = path.join(tmpDir, 'tts-' + uuidv4() + '.' + ext);

  fs.writeFileSync(tmpFile, result.audio);
  try {
    await storage.saveFromFile(tmpFile, key, result.isDev ? 'application/json' : 'audio/mp3');
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }

  var url = storage.getPublicUrl(key);
  var durationMs = result.isDev ? (text.length * 300) : Math.round(result.audio.length / 32);

  await db.run(
    'INSERT OR REPLACE INTO tts_cache (id, text_hash, voice_id, course_id, segment_index, audio_url, storage_key, duration_ms, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [uuidv4(), _hashText(text, voiceId), voiceId, courseId, segmentIndex, url, key, durationMs, 'ready', new Date().toISOString()]
  );

  return { ok: true, url: url, durationMs: durationMs, storageKey: key, isDev: !!result.isDev };
}

async function getCached(text, voiceId) {
  var hash = _hashText(text, voiceId);
  var row = await db.get('SELECT * FROM tts_cache WHERE text_hash = ? AND status = ?', [hash, 'ready']);
  if (row) {
    return { cached: true, url: row.audio_url, durationMs: row.duration_ms };
  }
  return { cached: false };
}

async function synthesizeCourseSegments(courseId, voiceId, options) {
  var course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!course) {
    return { ok: false, error: '课程不存在' };
  }

  var segments = await db.all('SELECT * FROM course_segments WHERE course_id = ? ORDER BY sort_order, segment_index', [courseId]);
  if (segments.length === 0) {
    return { ok: false, error: '课程没有段落数据，请先完成 ASR 分析或手动添加段落' };
  }

  var results = [];
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var text = seg.text || seg.cue || '';
    if (!text || text.trim().length === 0) {
      results.push({ segmentIndex: i, skipped: true });
      continue;
    }

    var cached = await getCached(text, voiceId);
    if (cached.cached) {
      results.push({ segmentIndex: i, url: cached.url, durationMs: cached.durationMs, cached: true });
      continue;
    }

    var synthResult = await synthesizeAndSave(text, voiceId, courseId, i, options);
    results.push({
      segmentIndex: i,
      url: synthResult.url,
      durationMs: synthResult.durationMs,
      isDev: synthResult.isDev,
      ok: synthResult.ok,
    });

    if (!synthResult.isDev) {
      await _sleep(200);
    }
  }

  return { ok: true, courseId: courseId, voiceId: voiceId, results: results, total: results.length };
}

function _hashText(text, voiceId) {
  return crypto.createHash('md5').update(text + '|' + voiceId).digest('hex');
}

function _sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

module.exports = {
  isConfigured: isConfigured,
  getVoices: getVoices,
  getVoice: getVoice,
  synthesize: synthesize,
  synthesizeAndSave: synthesizeAndSave,
  synthesizeCourseSegments: synthesizeCourseSegments,
  getCached: getCached,
};
