// File overview: app.js
var auth = require('./utils/auth');
var contentData = require('./utils/content-data');
var mediaService = require('./utils/media-service');

var CLOUD_ENV_ID = '';

// Register the mini program and initialize shared services once at launch.
App({
  // Configure runtime capabilities before any page starts using them.
  onLaunch: function () {
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        mixWithOther: false,
        obeyMuteSwitch: false
      });
    }

    this.globalData.loginState = auth.getLoginState();

    if (!wx.cloud) {
      this.globalData.cloudSupported = false;
    } else {
      this.globalData.cloudSupported = true;

      if (CLOUD_ENV_ID) {
        wx.cloud.init({
          env: CLOUD_ENV_ID,
          traceUser: true
        });
        this.globalData.cloudEnabled = true;
        this.globalData.cloudEnvId = CLOUD_ENV_ID;
      }
    }

    mediaService.setConfig({
      env: 'dev',
      apiBaseUrl: 'http://127.0.0.1:3002',
      localAudioBaseUrl: 'http://192.168.31.181:8123'
    });

    contentData.setApiBaseUrl(mediaService.API_BASE_URL);
  },

  // Shared state consumed by pages and components throughout the app.
  globalData: {
    appName: 'LYC 小宇宙学堂',
    loginState: null,
    cloudSupported: false,
    cloudEnabled: false,
    cloudEnvId: '',
    owner: 'LYC'
  }
});
