// File overview: utils\media-service.js
var LOCAL_AUDIO_BASE_URL = 'http://192.168.31.181:8123';

var API_BASE_URL = '';

var ENV_MODE = 'dev';

var CACHE_KEY_PREFIX = 'lyc_media_cache_';
var CACHE_EXPIRE_MS = 86400000;

// Centralize runtime media endpoints so pages do not hardcode host information.
function setConfig(config) {
  if (config.apiBaseUrl) API_BASE_URL = config.apiBaseUrl;
  if (config.env) ENV_MODE = config.env;
  if (config.localAudioBaseUrl) LOCAL_AUDIO_BASE_URL = config.localAudioBaseUrl;
}

// Resolve a lesson audio path into a playable URL for the current environment.
function getAudioUrl(lesson) {
  if (!lesson) return '';

  if (lesson.audioUrl && lesson.audioUrl.indexOf('://') !== -1) {
    return lesson.audioUrl;
  }

  if (ENV_MODE === 'dev' && lesson.audioUrl) {
    return LOCAL_AUDIO_BASE_URL + lesson.audioUrl;
  }

  if (lesson.audioUrl) {
    return lesson.audioUrl;
  }

  if (lesson.sourcePath && ENV_MODE === 'dev') {
    return LOCAL_AUDIO_BASE_URL + '/' + lesson.sourcePath.replace(/^\/+/, '');
  }

  return '';
}

function getVideoUrl(lesson) {
  if (!lesson) return '';
  if (lesson.videoUrl && lesson.videoUrl.indexOf('://') !== -1) {
    return lesson.videoUrl;
  }
  if (lesson.videoUrl) {
    return lesson.videoUrl;
  }
  return '';
}

function getStreamUrl(storageKey) {
  if (!storageKey) return '';
  if (ENV_MODE === 'dev' && storageKey.indexOf('://') === -1) {
    return LOCAL_AUDIO_BASE_URL + '/' + storageKey.replace(/^\/+/, '');
  }
  if (storageKey.indexOf('://') !== -1) {
    return storageKey;
  }
  return API_BASE_URL + '/api/v1/media/stream/' + encodeURIComponent(storageKey);
}

function getSignedUrl(fileId, expires) {
  if (!API_BASE_URL) return '';
  return API_BASE_URL + '/api/v1/media/signed-url/' + fileId + '?expires=' + (expires || 3600);
}

// Download remote media into a temp file so InnerAudioContext can play it reliably.
function downloadAndCache(url) {
  if (!url) return Promise.reject(new Error('URL 为空'));
  if (url.indexOf('https://') !== 0 && url.indexOf('http://') !== 0) {
    return Promise.resolve(url);
  }

  var cacheKey = CACHE_KEY_PREFIX + hashUrl(url);
  try {
    var cached = wx.getStorageSync(cacheKey);
    if (cached && cached.ts && Date.now() - cached.ts < CACHE_EXPIRE_MS && cached.path) {
      return Promise.resolve(cached.path);
    }
  } catch (_) {}

  return new Promise(function (resolve, reject) {
    var task = wx.downloadFile({
      url: url,
      timeout: 180000,
      success: function (res) {
        if (res.statusCode === 200 && res.tempFilePath) {
          try {
            wx.setStorageSync(cacheKey, { ts: Date.now(), path: res.tempFilePath });
          } catch (_) {}
          resolve(res.tempFilePath);
        } else {
          reject(new Error('下载失败，状态码 ' + res.statusCode));
        }
      },
      fail: function (err) {
        reject(err);
      }
    });

    if (task && task.onProgressUpdate) {
      task.onProgressUpdate(function () {});
    }
  });
}

// Remove cached downloads without touching unrelated app storage keys.
function clearMediaCache() {
  try {
    var res = wx.getStorageInfoSync();
    var keys = res.keys || [];
    keys.forEach(function (key) {
      if (key.indexOf(CACHE_KEY_PREFIX) === 0) {
        wx.removeStorageSync(key);
      }
    });
  } catch (_) {}
}

function hashUrl(url) {
  var hash = 0;
  for (var i = 0; i < url.length; i++) {
    var char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function isLocalDevAudio(sourcePath) {
  if (!sourcePath) return false;
  return /^http:\/\/(?:127\.0\.0\.1|localhost|192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i.test(sourcePath);
}

module.exports = {
  setConfig: setConfig,
  getAudioUrl: getAudioUrl,
  getVideoUrl: getVideoUrl,
  getStreamUrl: getStreamUrl,
  getSignedUrl: getSignedUrl,
  downloadAndCache: downloadAndCache,
  clearMediaCache: clearMediaCache,
  isLocalDevAudio: isLocalDevAudio,
  ENV_MODE: ENV_MODE,
  API_BASE_URL: API_BASE_URL,
};
