// File overview: pages\login\index.js
var mediaService = require('../../utils/media-service');
var auth = require('../../utils/auth');

var COUNTDOWN_SECONDS = 60;

// Login page supports WeChat login, SMS login, and child profile setup in one flow.
Page({
  data: {
    mode: 'wx',
    phoneNumber: '',
    smsCode: '',
    countdown: 0,
    isRegister: false,
    childNickname: '',
    childGender: 'undisclosed',
    ageDisplay: '',
    ageIndex: [0, 0],
    ageRanges: [['2018', '2019', '2020', '2021', '2022', '2023', '2024'], ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']],
    childBirthYear: 2022,
    childBirthMonth: 1,
  },

  onLoad: function (options) {
    this._token = null;
    this._userId = null;
    if (options && options.mode) {
      this.setData({ mode: options.mode });
    }
  },

  onPhoneInput: function (e) {
    this.setData({ phoneNumber: e.detail.value });
  },

  onCodeInput: function (e) {
    this.setData({ smsCode: e.detail.value });
  },

  switchToWx: function () {
    this.setData({ mode: 'wx' });
  },

  switchToPhone: function () {
    this.setData({ mode: 'phone' });
  },

  // Request an SMS code from the backend and expose the dev code in local testing.
  sendCode: function () {
    var phone = this.data.phoneNumber;
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (this.data.countdown > 0) return;

    var self = this;
    var apiBase = mediaService.API_BASE_URL;

    wx.request({
      url: apiBase + '/api/v1/auth/send-sms',
      method: 'POST',
      data: { phoneNumber: phone, purpose: 'login' },
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.success) {
          wx.showToast({ title: '验证码已发送', icon: 'none' });
          self.startCountdown();
          if (res.data.devCode) {
            self.setData({ smsCode: res.data.devCode });
          }
        } else {
          wx.showToast({ title: (res.data && res.data.error) || '发送失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      },
    });
  },

  startCountdown: function () {
    var self = this;
    self.setData({ countdown: COUNTDOWN_SECONDS });
    self._timer = setInterval(function () {
      var cur = self.data.countdown - 1;
      if (cur <= 0) {
        clearInterval(self._timer);
        self.setData({ countdown: 0 });
      } else {
        self.setData({ countdown: cur });
      }
    }, 1000);
  },

  // Finish phone login and branch into profile setup if the account is incomplete.
  smsLogin: function () {
    var phone = this.data.phoneNumber;
    var code = this.data.smsCode;
    if (!phone || !code) {
      wx.showToast({ title: '请输入手机号和验证码', icon: 'none' });
      return;
    }
    var self = this;
    var apiBase = mediaService.API_BASE_URL;

    wx.request({
      url: apiBase + '/api/v1/auth/sms-login',
      method: 'POST',
      data: { phoneNumber: phone, code: code },
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.token) {
          self._token = res.data.token;
          self._userId = res.data.user.id;
          self.saveSession(res.data);

          if (res.data.user.profileCompleted) {
            self.goBack();
          } else {
            self.setData({ mode: 'setup' });
          }
        } else {
          wx.showToast({ title: (res.data && res.data.error) || '登录失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  // Exchange the WeChat login code for an app session.
  wxLogin: function () {
    var self = this;
    wx.login({
      success: function (loginRes) {
        if (!loginRes.code) {
          wx.showToast({ title: '微信登录失败', icon: 'none' });
          return;
        }
        var apiBase = mediaService.API_BASE_URL;
        wx.request({
          url: apiBase + '/api/v1/auth/wx-login',
          method: 'POST',
          data: { code: loginRes.code },
          success: function (res) {
            if (res.statusCode === 200 && res.data && res.data.token) {
              self._token = res.data.token;
              self._userId = res.data.user.id;
              self.saveSession(res.data);

              if (res.data.user.profileCompleted) {
                self.goBack();
              } else {
                self.setData({ mode: 'setup' });
              }
            } else {
              wx.showToast({ title: (res.data && res.data.error) || '登录失败', icon: 'none' });
            }
          },
          fail: function () {
            wx.showToast({ title: '网络错误', icon: 'none' });
          },
        });
      },
      fail: function () {
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      },
    });
  },

  onChildNicknameInput: function (e) {
    this.setData({ childNickname: e.detail.value });
  },

  pickGender: function (e) {
    this.setData({ childGender: e.currentTarget.dataset.gender });
  },

  onAgePick: function (e) {
    var val = e.detail.value;
    var years = this.data.ageRanges[0];
    var months = this.data.ageRanges[1];
    var year = parseInt(years[val[0]], 10);
    var month = val[0] + 1;
    this.setData({
      ageIndex: val,
      ageDisplay: years[val[0]] + '年 ' + months[val[1]],
      childBirthYear: year,
      childBirthMonth: month,
    });
  },

  // Persist the child profile so recommendations can be tailored later.
  submitSetup: function () {
    var nickname = this.data.childNickname;
    if (!nickname) {
      wx.showToast({ title: '请输入宝贝昵称', icon: 'none' });
      return;
    }
    var self = this;
    var apiBase = mediaService.API_BASE_URL;

    wx.request({
      url: apiBase + '/api/v1/auth/child',
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + this._token },
      data: {
        nickname: nickname,
        birthYear: this.data.childBirthYear,
        birthMonth: this.data.childBirthMonth,
        gender: this.data.childGender,
      },
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.user) {
          self.saveSession(res.data);
          self.goBack();
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  skipSetup: function () {
    this.goBack();
  },

  // Normalize backend fields into the local storage contract used across pages.
  saveSession: function (data) {
    var session = {
      userId: data.user.id,
      token: data.token || this._token,
      openid: data.user.openid || '',
      nickname: data.user.nickname || '',
      avatarUrl: data.user.avatarUrl || '',
      phoneVerified: data.user.phoneVerified || false,
      profileCompleted: data.user.profileCompleted || false,
      loginTime: new Date().toISOString(),
    };
    auth._saveSession(session);
  },

  goBack: function () {
    var pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/home/index' });
    }
  },

  onUnload: function () {
    if (this._timer) clearInterval(this._timer);
  },
});
