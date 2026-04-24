// File overview: pages\profile\index.js
var auth = require('../../utils/auth');
var mediaService = require('../../utils/media-service');

// Profile page merges local session data with the latest backend account snapshot.
Page({
  data: {
    isLoggedIn: false,
    user: { nickname: '', phoneVerified: false, phoneNumber: '', avatarUrl: '' },
      child: null,
    initial: '?',
    maskedPhone: '',
  },

  onShow: function () {
    this.loadProfile();
  },

  // Render quickly from storage first, then refresh from the server when possible.
  loadProfile: function () {
    var session = auth.getSession();
    var isLoggedIn = auth.isLoggedIn();
    var nickname = session.nickname || '';
    var initial = nickname ? nickname.charAt(0) : '?';

    var phone = session.phoneNumber || '';
    var masked = phone ? phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
    this.setData({
      isLoggedIn: isLoggedIn,
      user: {
        nickname: nickname || '',
        phoneVerified: session.phoneVerified || false,
        phoneNumber: phone,
        avatarUrl: session.avatarUrl || '',
      },
      child: session.child || null,
      initial: initial,
      maskedPhone: masked,
    });

    if (isLoggedIn && session.token) {
      this.fetchProfile(session.token);
    }
  },

  // Pull the latest user and child profile so account settings stay fresh.
  fetchProfile: function (token) {
    var apiBase = mediaService.API_BASE_URL;
    var self = this;
    wx.request({
      url: apiBase + '/api/v1/auth/profile',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.user) {
          var u = res.data.user;
          var child = res.data.children && res.data.children.length > 0 ? res.data.children[0] : null;
          var nickname = u.nickname || '';
          auth._saveSession({
            userId: u.id,
            token: token,
            nickname: nickname,
            avatarUrl: u.avatarUrl || '',
            phoneVerified: u.phoneVerified,
            phoneNumber: u.phoneNumber || '',
            profileCompleted: u.profileCompleted,
            child: child,
          });
          var phone = u.phoneNumber || '';
          self.setData({
            user: { nickname: nickname, phoneVerified: u.phoneVerified, phoneNumber: phone, avatarUrl: u.avatarUrl || '' },
            child: child,
            initial: nickname ? nickname.charAt(0) : '?',
            maskedPhone: phone ? phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '',
          });
        }
      },
    });
  },

  goLogin: function () {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  goSetup: function () {
    wx.navigateTo({ url: '/pages/login/index?mode=setup' });
  },

  goBindPhone: function () {
    wx.navigateTo({ url: '/pages/login/index?mode=phone' });
  },

  editChild: function () {
    wx.navigateTo({ url: '/pages/login/index?mode=setup' });
  },

  clearCache: function () {
    try { wx.clearStorageSync(); } catch (_) {}
    wx.showToast({ title: '缓存已清除', icon: 'none' });
  },

  showAbout: function () {
    wx.showModal({
      title: '关于',
      content: 'LYC 小宇宙学堂 v1.0\n每天十分钟，和孩子一起听、读、唱。',
      showCancel: false,
    });
  },

  handleLogout: function () {
    wx.showModal({
      title: '确认退出',
      content: '退出后学习记录不会丢失，重新登录即可恢复。',
      success: function (res) {
        if (res.confirm) {
          auth.logout();
          wx.switchTab({ url: '/pages/home/index' });
        }
      },
    });
  },
});
