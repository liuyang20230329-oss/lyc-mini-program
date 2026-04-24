// File overview: components\voice-picker\index.js
var mediaService = require('../../utils/media-service');
var auth = require('../../utils/auth');

// Voice picker loads available TTS voices and returns the selected id to the page.
Component({
  properties: {
    visible: { type: Boolean, value: false },
    currentVoiceId: { type: String, value: 'xiaoyue' },
  },

  data: {
    voices: [],
    selectedVoiceId: 'xiaoyue',
  },

  observers: {
    'currentVoiceId': function (val) {
      this.setData({ selectedVoiceId: val });
    },
  },

  lifetimes: {
    attached: function () {
      this.loadVoices();
    },
  },

  methods: {
    // Prefer backend voices, but fall back to a local demo list for offline development.
    loadVoices: function () {
      var self = this;
      var apiBase = mediaService.API_BASE_URL;
      wx.request({
        url: apiBase + '/api/v1/tts/voices',
        method: 'GET',
        success: function (res) {
          if (res.statusCode === 200 && res.data && res.data.voices) {
            self.setData({ voices: res.data.voices });
          }
        },
        fail: function () {
          self.setData({
            voices: [
              { id: 'xiaoyue', name: '小月', desc: '甜美女童', avatar: '🌙' },
              { id: 'xiaobei', name: '小北', desc: '活泼男童', avatar: '🌟' },
              { id: 'xiaomei', name: '小美', desc: '温柔姐姐', avatar: '🌸' },
              { id: 'aitong', name: '艾童', desc: '标准童声', avatar: '🎀' },
              { id: 'xiaoyun', name: '小云', desc: '邻家男孩', avatar: '☁' },
              { id: 'siyue', name: '思悦', desc: '知性姐姐', avatar: '📖' },
            ],
          });
        },
      });
    },

    pickVoice: function (e) {
      var voiceId = e.currentTarget.dataset.voice;
      this.setData({ selectedVoiceId: voiceId });
    },

    // The preview call is server-side, so it reuses the logged-in bearer token.
    previewVoice: function () {
      var voiceId = this.data.selectedVoiceId;
      var token = auth.getToken();
      var apiBase = mediaService.API_BASE_URL;

      wx.request({
        url: apiBase + '/api/v1/tts/preview',
        method: 'POST',
        header: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        data: { text: '你好呀，我是你的小伙伴，快来和我一起学习吧！', voiceId: voiceId },
        success: function (res) {
          if (res.statusCode === 200) {
            wx.showToast({ title: '试听请求已发送', icon: 'none' });
          }
        },
      });
    },

    confirmVoice: function () {
      this.triggerEvent('change', { voiceId: this.data.selectedVoiceId });
      this.triggerEvent('close');
    },

    handleOverlayTap: function () {
      this.triggerEvent('close');
    },
  },
});
