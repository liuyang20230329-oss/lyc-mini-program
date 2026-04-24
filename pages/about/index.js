// File overview: pages\about\index.js
const { PARENT_PANEL } = require('../../utils/content-data');
const auth = require('../../utils/auth');
const {
  COPY,
  LOGIN_SHEET_SCENARIOS,
  getLoginSheetContent
} = require('../../utils/copy');

// Parent page packages guidance, observations, and account-aware actions.
Page({
  data: {
    observations: PARENT_PANEL.observations,
    schedules: PARENT_PANEL.schedules,
    tips: PARENT_PANEL.tips,
    todo: PARENT_PANEL.todo,
    quietModeEnabled: true,
    isGuestMode: true,
    userProfile: auth.getUserProfile(),
    showLoginSheet: false,
    loginSheet: getLoginSheetContent(LOGIN_SHEET_SCENARIOS.PARENT_GUARD)
  },

  onShow: function () {
    this.syncTabBar(3);
    this.syncAuthState();
  },

  syncAuthState: function () {
    this.setData({
      isGuestMode: !auth.isLoggedIn(),
      userProfile: auth.getUserProfile()
    });
  },

  // Quiet mode is currently a local toggle, but it already respects login gating.
  toggleQuietMode: function () {
    if (this.data.isGuestMode) {
      this.openLoginSheet();
      return;
    }

    const nextState = !this.data.quietModeEnabled;

    this.setData({
      quietModeEnabled: nextState
    });

    wx.showToast({
      title: nextState ? '已开启温和提醒' : '已关闭温和提醒',
      icon: 'none'
    });
  },

  openDiscover: function () {
    wx.switchTab({
      url: '/pages/discover/index'
    });
  },

  openLoginSheet: function () {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  closeLoginSheet: function () {},

  handleLoginConfirm: function () {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  handleLogout: function () {
    auth.logout();
    this.syncAuthState();

    wx.showToast({
      title: '已退出登录',
      icon: 'none'
    });
  },

  syncTabBar: function (selected) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: selected
      });
    }
  }
});
