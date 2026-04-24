// File overview: pages\history\index.js
const {
  GROWTH_PANEL,
  getContinueLesson
} = require('../../utils/content-data');
const auth = require('../../utils/auth');
const {
  COPY,
  LOGIN_SHEET_SCENARIOS,
  getLoginSheetContent
} = require('../../utils/copy');

// History page presents either a login upsell or a growth dashboard.
Page({
  data: {
    totalStars: GROWTH_PANEL.totalStars,
    streakDays: GROWTH_PANEL.streakDays,
    totalMinutes: GROWTH_PANEL.totalMinutes,
    weekProgress: GROWTH_PANEL.weekProgress,
    missions: GROWTH_PANEL.missions,
    badges: GROWTH_PANEL.badges,
    continueLesson: getContinueLesson(),
    isGuestMode: true,
    showLoginSheet: false,
    loginSheet: getLoginSheetContent(LOGIN_SHEET_SCENARIOS.GROWTH_GUARD)
  },

  onShow: function () {
    this.syncTabBar(2);
    this.syncAuthState();
  },

  syncAuthState: function () {
    this.setData({
      isGuestMode: !auth.isLoggedIn()
    });
  },

  // Resume the last lesson only after the user is allowed to access growth records.
  openContinue: function () {
    if (this.data.isGuestMode) {
      this.openLoginSheet();
      return;
    }

    wx.navigateTo({
      url: '/pages/tool/index?id=' + this.data.continueLesson.id
    });
  },

  claimMission: function (event) {
    const title = event.currentTarget.dataset.title;

    if (this.data.isGuestMode) {
      this.openLoginSheet();
      return;
    }

    wx.showToast({
      title: title + ' 已记录',
      icon: 'none'
    });
  },

  openLoginSheet: function () {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  closeLoginSheet: function () {},

  handleLoginConfirm: function () {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  syncTabBar: function (selected) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: selected
      });
    }
  }
});
