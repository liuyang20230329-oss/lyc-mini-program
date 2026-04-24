var https = require('https');
var DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
var DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

function isConfigured() {
  return DASHSCOPE_API_KEY.length > 0;
}

function _request(body) {
  return new Promise(function (resolve, reject) {
    var data = JSON.stringify(body);
    var url = new URL(DASHSCOPE_URL);
    var options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + DASHSCOPE_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    var req = https.request(options, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf-8');
        try { resolve(JSON.parse(raw)); } catch (_) { resolve({ error: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function segmentByText(sentences, options) {
  if (!sentences || sentences.length === 0) return [];

  var opts = options || {};
  var minSegmentDuration = opts.minSegmentDuration || 5;
  var maxSegmentDuration = opts.maxSegmentDuration || 30;
  var targetSegmentCount = opts.targetSegmentCount || Math.max(2, Math.ceil(sentences.length / 4));

  if (isConfigured()) {
    try {
      return await aiSegment(sentences, targetSegmentCount, minSegmentDuration, maxSegmentDuration);
    } catch (err) {
      console.error('AI 分段失败，回退到规则分段:', err.message);
    }
  }

  return ruleBasedSegment(sentences, minSegmentDuration, maxSegmentDuration);
}

async function aiSegment(sentences, targetCount, minDuration, maxDuration) {
  var textList = sentences.map(function (s, i) {
    return '[' + i + '](' + Math.round(s.startTime / 1000) + 's-' + Math.round(s.endTime / 1000) + 's)' + s.text;
  }).join('\n');

  var prompt = '你是一个儿童教育内容编辑。下面是一段儿童学习音频的语音识别结果，每行格式为 [序号](起始秒-结束秒)文本。\n\n' +
    '请将这些句子按语义切分为 ' + targetCount + ' 个左右的学习段落。每个段落应该是完整的意思单元，适合小朋友逐段学习。\n\n' +
    '要求：\n' +
    '1. 每段时长在 ' + minDuration + '-' + maxDuration + ' 秒之间\n' +
    '2. 每段包含 2-5 句话\n' +
    '3. 为每段生成一个简短小标题（5字以内）\n' +
    '4. 严格按照 JSON 数组格式返回，不要包含其他文字\n\n' +
    '返回格式：\n' +
    '[{"index":1,"title":"小标题","startSentenceIdx":0,"endSentenceIdx":3}]\n\n' +
    '以下是语音识别结果：\n' + textList;

  var body = {
    model: 'qwen-turbo',
    input: { messages: [{ role: 'user', content: prompt }] },
    parameters: { result_format: 'message', temperature: 0.1 },
  };

  var result = await _request(body);

  if (result.output && result.output.choices && result.output.choices[0]) {
    var content = result.output.choices[0].message.content;
    var jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      var aiSegments = JSON.parse(jsonMatch[0]);
      return buildSegmentsFromAI(sentences, aiSegments);
    }
  }

  throw new Error('AI 返回格式异常');
}

function ruleBasedSegment(sentences, minDuration, maxDuration) {
  var segments = [];
  var currentGroup = [];
  var groupStartMs = 0;
  var segmentIndex = 0;

  for (var i = 0; i < sentences.length; i++) {
    var sentence = sentences[i];
    var groupDuration = sentence.endTime - groupStartMs;
    var silenceGap = 0;

    if (currentGroup.length > 0) {
      var prevEnd = currentGroup[currentGroup.length - 1].endTime;
      silenceGap = sentence.startTime - prevEnd;
    }

    var shouldBreak = false;

    if (groupDuration >= maxDuration * 1000) {
      shouldBreak = true;
    } else if (silenceGap >= 1500 && currentGroup.length >= 2) {
      shouldBreak = true;
    } else if (currentGroup.length >= 5) {
      shouldBreak = true;
    }

    if (shouldBreak && currentGroup.length > 0) {
      segments.push(createSegment(segmentIndex, currentGroup, groupStartMs));
      segmentIndex++;
      currentGroup = [];
      groupStartMs = sentence.startTime;
    }

    if (currentGroup.length === 0) {
      groupStartMs = sentence.startTime;
    }
    currentGroup.push(sentence);
  }

  if (currentGroup.length > 0) {
    segments.push(createSegment(segmentIndex, currentGroup, groupStartMs));
  }

  return segments;
}

function createSegment(index, sentences, startMs) {
  var text = sentences.map(function (s) { return s.text; }).join('');
  var endMs = sentences[sentences.length - 1].endTime;
  var durationMs = endMs - startMs;

  return {
    index: index,
    title: generateTitle(text, index),
    text: text,
    startTimeMs: startMs,
    endTimeMs: endMs,
    durationMs: durationMs,
    sentenceCount: sentences.length,
    sentences: sentences,
  };
}

function generateTitle(text, index) {
  var titleMap = ['开篇', '展开', '深入', '转折', '高潮', '收尾'];
  if (index < titleMap.length) return titleMap[index];
  return '第 ' + (index + 1) + ' 段';
}

function buildSegmentsFromAI(sentences, aiSegments) {
  var results = [];
  for (var i = 0; i < aiSegments.length; i++) {
    var ai = aiSegments[i];
    var startIdx = ai.startSentenceIdx || 0;
    var endIdx = ai.endSentenceIdx !== undefined ? ai.endSentenceIdx : startIdx;
    var group = sentences.slice(startIdx, endIdx + 1);

    if (group.length === 0) continue;

    var startMs = group[0].startTime;
    var endMs = group[group.length - 1].endTime;
    var text = group.map(function (s) { return s.text; }).join('');

    results.push({
      index: i,
      title: ai.title || generateTitle(text, i),
      text: text,
      startTimeMs: startMs,
      endTimeMs: endMs,
      durationMs: endMs - startMs,
      sentenceCount: group.length,
      sentences: group,
    });
  }
  return results;
}

module.exports = {
  isConfigured: isConfigured,
  segmentByText: segmentByText,
  ruleBasedSegment: ruleBasedSegment,
};
