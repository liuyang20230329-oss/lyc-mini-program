// File overview: pages\home\index.js
const {
  CATEGORY_LIST,
  HOME_PLAYLISTS,
  GROWTH_PANEL,
  getContinueLesson,
  getLessonsByIds
} = require('../../utils/content-data');
const auth = require('../../utils/auth');
const {
  COPY,
  LOGIN_SHEET_SCENARIOS,
  getLoginSheetContent
} = require('../../utils/copy');

// Home page combines entry categories, quick resume, and recommendation shelves.
Page({
  data: {
    appName: 'LYC 小宇宙学堂',
    greeting: '',
    categoryList: CATEGORY_LIST,
    continueLesson: null,
    todayList: [],
    bedtimeList: [],
    totalStars: GROWTH_PANEL.totalStars,
    streakDays: GROWTH_PANEL.streakDays,
    isGuestMode: true,
    showLoginSheet: false,
    loginSheet: getLoginSheetContent(LOGIN_SHEET_SCENARIOS.PLAY_UNLOCK)
  },

  // Refresh derived UI every time the tab becomes visible.
  onShow: function () {
    this.syncTabBar(0);
    this.buildGreeting();
    this.loadData();
    this.syncAuthState();
  },

  // Keep the hero copy aligned with the current time of day.
  buildGreeting: function () {
    var hour = new Date().getHours();
    var greeting = '你好呀';

    if (hour >= 5 && hour < 12) {
      greeting = '早安，新的一天';
    } else if (hour >= 12 && hour < 18) {
      greeting = '下午好，继续探索';
    } else if (hour >= 18 && hour < 22) {
      greeting = '晚上好，睡前时光';
    } else {
      greeting = '夜深了，听听故事吧';
    }

    this.setData({ greeting: greeting });
  },

  // Compose the page from static fixtures exposed by the content module.
  loadData: function () {
    var continueLesson = getContinueLesson();
    var todayList = getLessonsByIds(HOME_PLAYLISTS.todayIds);
    var bedtimeList = getLessonsByIds(HOME_PLAYLISTS.bedtimeIds);

    this.setData({
      continueLesson: continueLesson,
      todayList: todayList,
      bedtimeList: bedtimeList
    });
  },

  syncAuthState: function () {
    this.setData({
      isGuestMode: !auth.isLoggedIn()
    });
  },

  openCategory: function (event) {
    var item = event.detail;
    if (!item || !item.id) return;

    wx.switchTab({
      url: '/pages/discover/index'
    });
  },

  openContinue: function () {
    var lesson = this.data.continueLesson;
    if (!lesson) return;

    wx.navigateTo({
      url: '/pages/tool/index?id=' + lesson.id
    });
  },

  openLesson: function (event) {
    var lesson = event.detail;
    if (!lesson || !lesson.id) return;

    wx.navigateTo({
      url: '/pages/tool/index?id=' + lesson.id
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
