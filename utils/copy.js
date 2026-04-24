// File overview: utils\copy.js
// Shared copy tokens keep repeated toast text in one place.
var COPY = {
  loginSuccessToast: '登录成功',
  loginFailedToast: '登录失败，请重试',
};

// Each guarded action picks the dialog text that matches its login scenario.
var LOGIN_SHEET_SCENARIOS = {
  PLAY_UNLOCK: { title: '继续收听', body: '登录后可以完整收听所有内容，收藏喜欢的课程。', primaryText: '微信一键登录', secondaryText: '稍后再说' },
  QUOTA_EXHAUSTED: { title: '今日试听已用完', body: '每天可试听 3 次，登录后不受限制。', primaryText: '立即登录解锁', secondaryText: '明天再来' },
  TRIAL_FINISHED: { title: '试听结束', body: '这段内容还在继续，登录后可以听完。', primaryText: '登录继续收听', secondaryText: '返回' },
  FAVORITE_GUARD: { title: '收藏需要登录', body: '登录后可以收藏喜欢的课程，随时回来继续学习。', primaryText: '去登录', secondaryText: '取消' },
  GROWTH_GUARD: { title: '成长记录需要登录', body: '登录后会自动保存学习时长、星星和连续天数。', primaryText: '去登录', secondaryText: '下次再说' },
  PARENT_GUARD: { title: '家长中心需要登录', body: '登录后可以看到孩子的学习数据和陪伴建议。', primaryText: '去登录', secondaryText: '返回' },
};

function getLoginSheetContent(scenario) {
  return scenario || LOGIN_SHEET_SCENARIOS.PLAY_UNLOCK;
}

module.exports = {
  COPY: COPY,
  LOGIN_SHEET_SCENARIOS: LOGIN_SHEET_SCENARIOS,
  getLoginSheetContent: getLoginSheetContent,
};
