// File overview: utils\trial.js
var TRIAL_KEY = 'lyc_trial_state';

// Trial rules stay centralized so the page logic only consumes derived state.
function getTrialConfig() {
  return {
    maxCountPerDay: 3,
    maxSeconds: 30,
  };
}

function getTrialState() {
  var config = getTrialConfig();
  try {
    var stored = wx.getStorageSync(TRIAL_KEY);
    if (stored && stored.date === todayStr()) {
      return { count: stored.count || 0, maxCount: config.maxCountPerDay, maxSeconds: config.maxSeconds, date: stored.date };
    }
  } catch (_) {}
  return { count: 0, maxCount: config.maxCountPerDay, maxSeconds: config.maxSeconds, date: todayStr() };
}

// Expose both permission and remaining quota for guest playback prompts.
function canStartTrial() {
  var state = getTrialState();
  return { allowed: state.count < state.maxCount, remaining: state.maxCount - state.count };
}

// Persist one guest trial usage as soon as playback is allowed to begin.
function consumeTrialCount() {
  var state = getTrialState();
  var newCount = state.count + 1;
  var result = { count: newCount, maxCount: state.maxCount, maxSeconds: state.maxSeconds };
  try { wx.setStorageSync(TRIAL_KEY, { count: newCount, date: todayStr() }); } catch (_) {}
  return result;
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

module.exports = {
  getTrialConfig: getTrialConfig,
  getTrialState: getTrialState,
  canStartTrial: canStartTrial,
  consumeTrialCount: consumeTrialCount,
};
