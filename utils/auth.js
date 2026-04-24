// File overview: utils\auth.js
var SESSION_KEY = 'lyc_auth_session';

// Read the persisted login session and normalize it into a page-friendly shape.
function getLoginState() {
  try {
    var session = wx.getStorageSync(SESSION_KEY);
    if (session && session.userId && session.token) {
      return { isLoggedIn: true, userId: session.userId, token: session.token };
    }
  } catch (_) {}
  return { isLoggedIn: false, userId: null, token: null };
}

function isLoggedIn() {
  return getLoginState().isLoggedIn;
}

function getSession() {
  try {
    return wx.getStorageSync(SESSION_KEY) || {};
  } catch (_) {
    return {};
  }
}

function getUserProfile() {
  var session = getSession();
  return {
    nickname: session.nickname || '访客',
    avatarUrl: session.avatarUrl || '',
    userId: session.userId || '',
    phoneVerified: session.phoneVerified || false,
    profileCompleted: session.profileCompleted || false,
  };
}

function getToken() {
  return getSession().token || '';
}

// Create a lightweight demo session after WeChat returns a login code.
function loginWithWechat() {
  return new Promise(function (resolve, reject) {
    wx.login({
      success: function (loginRes) {
        if (loginRes.code) {
          var session = {
            userId: 'user-' + Date.now(),
            token: 'demo-token-' + Date.now(),
            nickname: '微信用户',
            avatarUrl: '',
            loginTime: new Date().toISOString(),
          };
          try { wx.setStorageSync(SESSION_KEY, session); } catch (_) {}
          resolve(session);
        } else {
          reject(new Error('wx.login 失败'));
        }
      },
      fail: function (err) { reject(err); }
    });
  });
}

function logout() {
  try { wx.removeStorageSync(SESSION_KEY); } catch (_) {}
}

// Remember the action that should resume after the user finishes logging in.
function savePendingAction(action) {
  try { wx.setStorageSync('lyc_pending_action', action); } catch (_) {}
}

function consumePendingAction() {
  try {
    var action = wx.getStorageSync('lyc_pending_action');
    wx.removeStorageSync('lyc_pending_action');
    return action || null;
  } catch (_) { return null; }
}

function clearLoginSession() {
  try { wx.removeStorageSync(SESSION_KEY); } catch (_) {}
}

function _saveSession(session) {
  try { wx.setStorageSync(SESSION_KEY, session); } catch (_) {}
}

module.exports = {
  getLoginState: getLoginState,
  isLoggedIn: isLoggedIn,
  getSession: getSession,
  getUserProfile: getUserProfile,
  getToken: getToken,
  loginWithWechat: loginWithWechat,
  logout: logout,
  savePendingAction: savePendingAction,
  consumePendingAction: consumePendingAction,
  clearLoginSession: clearLoginSession,
  _saveSession: _saveSession,
};
