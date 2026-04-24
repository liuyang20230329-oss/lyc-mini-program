// File overview: pages\discover\index.js
const {
  CATEGORY_LIST,
  getLessonsByCategory
} = require('../../utils/content-data');

// Discover page filters lessons by the active top-level category.
Page({
  data: {
    categoryList: CATEGORY_LIST,
    activeCategoryId: CATEGORY_LIST[0].id,
    activeCategoryName: CATEGORY_LIST[0].name,
    lessonList: []
  },

  onShow: function () {
    this.syncTabBar(1);
    this.switchCategory(this.data.activeCategoryId);
  },

  handleTabTap: function (event) {
    var categoryId = event.currentTarget.dataset.id;
    if (!categoryId || categoryId === this.data.activeCategoryId) return;

    this.switchCategory(categoryId);
  },

  // Rebuild the visible lesson list whenever the category tab changes.
  switchCategory: function (categoryId) {
    var lessonList = getLessonsByCategory(categoryId);
    var categoryName = '';

    CATEGORY_LIST.forEach(function (c) {
      if (c.id === categoryId) categoryName = c.name;
    });

    this.setData({
      activeCategoryId: categoryId,
      activeCategoryName: categoryName,
      lessonList: lessonList
    });
  },

  openLesson: function (event) {
    var lesson = event.detail;
    if (!lesson || !lesson.id) return;

    wx.navigateTo({
      url: '/pages/tool/index?id=' + lesson.id
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
