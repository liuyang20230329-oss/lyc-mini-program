const crypto = require('crypto');
const https = require('https');

var APP_KEY = process.env.ALIYUN_ASR_APP_KEY || '';
var ACCESS_KEY = process.env.ALIYUN_ASR_ACCESS_KEY || '';
var ACCESS_SECRET = process.env.ALIYUN_ASR_ACCESS_SECRET || '';
var SERVICE_URL = process.env.ALIYUN_ASR_URL || 'https://fileasr.cn-beijing.aliyuncs.com';

function isConfigured() {
  return APP_KEY.length > 0 && ACCESS_KEY.length > 0 && ACCESS_SECRET.length > 0;
}

function _signature(method, url, date) {
  var accept = 'application/json';
  var contentMd5 = '';
  var contentType = 'application/json';
  var stringToSign = method + '\n' + accept + '\n' + contentMd5 + '\n' + contentType + '\n' + date + '\n' + url;
  var hmac = crypto.createHmac('sha1', ACCESS_SECRET);
  return 'ACR ' + ACCESS_KEY + ':' + hmac.update(stringToSign).digest('base64');
}

function _request(method, path, body) {
  return new Promise(function (resolve, reject) {
    var date = new Date().toUTCString();
    var url = new URL(SERVICE_URL);
    var data = body ? JSON.stringify(body) : '';
    var headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Date': date,
      'Authorization': _signature(method, path, date),
    };
    if (data) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }

    var options = {
      hostname: url.hostname,
      port: 443,
      path: path,
      method: method,
      headers: headers,
    };

    var req = https.request(options, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf-8');
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
        } catch (_) {
          resolve({ statusCode: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function startRecognition(ossUrl, options) {
  if (!isConfigured()) {
    throw new Error('ASR 未配置，请设置 ALIYUN_ASR_APP_KEY 等环境变量');
  }

  var opts = options || {};
  var body = {
    app_key: APP_KEY,
    file_link: ossUrl,
    enable_words: true,
    enable_sample_rate: false,
    max_start_silence: 10000,
    max_end_silence: 800,
  };

  if (opts.languageHint) {
    body.language_hint = opts.languageHint;
  }

  var result = await _request('POST', '/pop/2019-02-28/files', body);

  if (result.statusCode === 200 && result.body && result.body.TaskId) {
    return {
      taskId: result.body.TaskId,
      status: 'submitted',
    };
  }

  throw new Error('ASR 提交失败: ' + JSON.stringify(result.body));
}

async function getRecognitionResult(taskId) {
  if (!isConfigured()) {
    throw new Error('ASR 未配置');
  }

  var path = '/pop/2019-02-28/files/' + taskId;
  var result = await _request('GET', path, null);

  if (result.statusCode !== 200 || !result.body) {
    return { status: 'error', message: '查询失败' };
  }

  var body = result.body;

  if (body.StatusCode === '21010000' || body.StatusText === 'SUCCESS') {
    var sentences = [];
    if (body.Result && body.Result.Sentences) {
      sentences = body.Result.Sentences.map(function (s) {
        return {
          text: s.Text || '',
          startTime: s.BeginTime || 0,
          endTime: s.EndTime || 0,
          channel: s.ChannelId || 0,
          speakerId: s.SpeakerId || '',
          silenceDuration: s.SilenceDuration || 0,
          emotionValue: s.EmotionValue || 0,
        };
      });
    }

    var fullText = sentences.map(function (s) { return s.text; }).join('');

    return {
      status: 'completed',
      taskId: taskId,
      fullText: fullText,
      sentences: sentences,
      duration: body.Result ? body.Result.Duration : 0,
    };
  }

  if (body.StatusCode === '21010002' || body.StatusText === 'PROCESSING' || body.StatusText === 'QUEUEING') {
    return {
      status: 'processing',
      taskId: taskId,
      progress: body.Result ? body.Result.Progress : 0,
    };
  }

  return {
    status: 'error',
    taskId: taskId,
    message: body.StatusText || '未知状态',
  };
}

function extractSentencesFromLocalData(segments) {
  if (!Array.isArray(segments)) return [];
  return segments.map(function (seg, index) {
    return {
      text: seg.text || seg.translation || '',
      startTime: seg.startTimeMs || seg.start_time_ms || 0,
      endTime: seg.endTimeMs || seg.end_time_ms || 0,
      channel: 0,
      speakerId: '',
      silenceDuration: 0,
      emotionValue: 0,
    };
  });
}

module.exports = {
  isConfigured: isConfigured,
  startRecognition: startRecognition,
  getRecognitionResult: getRecognitionResult,
  extractSentencesFromLocalData: extractSentencesFromLocalData,
};
