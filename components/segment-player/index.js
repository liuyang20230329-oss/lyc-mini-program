// File overview: components\segment-player\index.js
var mediaService = require('../../utils/media-service');

// Segment player breaks one lesson into smaller repeatable practice units.
Component({
  properties: {
    segments: { type: Array, value: [] },
    audioUrl: { type: String, value: '' },
    autoPlay: { type: Boolean, value: false },
    showFollowMode: { type: Boolean, value: true },
  },

  data: {
    currentSegmentIndex: 0,
    isPlaying: false,
    isFinished: false,
    segmentProgress: 0,
    currentTimeText: '0:00',
    segmentDurationText: '0:00',
    followMode: false,
    autoNext: true,
    loopCurrent: false,
    isWaitingFollow: false,
    currentSegment: null,
    totalSegments: 0,
  },

  lifetimes: {
    attached: function () {
      this._audioContext = null;
      this._followTimer = null;
    },
    detached: function () {
      this.destroyAudio();
      this.clearFollowTimer();
    },
  },

  observers: {
    'segments': function (list) {
      this.setData({ totalSegments: list.length });
      if (list.length > 0 && !this.data.currentSegment) {
        this.selectSegment({ currentTarget: { dataset: { index: 0 } } });
      }
    },
  },

  methods: {
    // Keep segment selection, playback position, and parent notifications in sync.
    selectSegment: function (e) {
      var index = typeof e === 'number' ? e : (e.currentTarget && e.currentTarget.dataset.index);
      if (index === undefined || index < 0 || index >= this.properties.segments.length) return;
      var seg = this.properties.segments[index];
      this.setData({ currentSegmentIndex: index, currentSegment: seg, isFinished: false, segmentProgress: 0 });
      this.clearFollowTimer();
      if (this.data.isPlaying) {
        this._seekToSegment(seg);
      }
      this.triggerEvent('segmentchange', { index: index, segment: seg });
    },

    togglePlay: function () {
      if (!this.properties.audioUrl && !(this.properties.segments.length > 0 && this.data.currentSegment)) {
        wx.showToast({ title: '没有可播放的音频', icon: 'none' });
        return;
      }
      if (this.data.isPlaying) {
        this.pauseAudio();
      } else {
        this.playCurrentSegment();
      }
    },

    prevSegment: function () {
      var idx = this.data.currentSegmentIndex - 1;
      if (idx < 0) idx = 0;
      this.selectSegment(idx);
      if (this.data.isPlaying) this.playCurrentSegment();
    },

    nextSegment: function () {
      var idx = this.data.currentSegmentIndex + 1;
      if (idx >= this.properties.segments.length) {
        this.setData({ isFinished: true });
        this.pauseAudio();
        this.triggerEvent('completed', {});
        return;
      }
      this.selectSegment(idx);
      if (this.data.isPlaying) this.playCurrentSegment();
    },

    toggleFollowMode: function () {
      this.setData({ followMode: !this.data.followMode });
    },

    toggleAutoNext: function () {
      this.setData({ autoNext: !this.data.autoNext });
    },

    toggleLoop: function () {
      this.setData({ loopCurrent: !this.data.loopCurrent });
    },

    skipFollow: function () {
      this.clearFollowTimer();
      this.setData({ isWaitingFollow: false });
      if (this.data.autoNext) this.nextSegment();
    },

    // Cache the backing audio once, then seek into the active segment boundaries.
    playCurrentSegment: function () {
      var seg = this.data.currentSegment;
      if (!seg) return;

      this.initAudio();
      if (!this._audioContext) {
        wx.showToast({ title: '播放器初始化失败', icon: 'none' });
        return;
      }

      var audioUrl = this.properties.audioUrl;
      if (!audioUrl) {
        wx.showToast({ title: '没有音频地址', icon: 'none' });
        return;
      }

      mediaService.downloadAndCache(audioUrl).then(function (playableUrl) {
        if (!this._audioContext) return;
        if (this._currentAudioUrl !== audioUrl) {
          this._audioContext.src = playableUrl;
          this._currentAudioUrl = audioUrl;
        }
        if (seg.startTimeMs) {
          this._audioContext.seek(seg.startTimeMs / 1000);
        }
        this._audioContext.play();
        this.setData({ isPlaying: true });
      }.bind(this)).catch(function () {
        wx.showToast({ title: '音频加载失败', icon: 'none' });
      }.bind(this));
    },

    pauseAudio: function () {
      if (this._audioContext) this._audioContext.pause();
      this.setData({ isPlaying: false });
    },

    // Audio callbacks update progress and detect when the current segment is complete.
    initAudio: function () {
      if (this._audioContext) return;
      if (!wx.createInnerAudioContext) return;

      var ctx = wx.createInnerAudioContext();
      ctx.obeyMuteSwitch = false;
      var self = this;

      ctx.onTimeUpdate(function () {
        var seg = self.data.currentSegment;
        if (!seg) return;
        var currentMs = ctx.currentTime * 1000;
        var startMs = seg.startTimeMs || 0;
        var endMs = seg.endTimeMs || (startMs + 30000);
        var durationMs = endMs - startMs;
        var elapsedMs = currentMs - startMs;
        var progress = durationMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100)) : 0;

        self.setData({
          segmentProgress: progress,
          currentTimeText: formatTime(currentMs),
          segmentDurationText: formatTime(durationMs),
        });

        if (currentMs >= endMs / 1000 && endMs > 0) {
          self._onSegmentEnd();
        }
      });

      ctx.onEnded(function () { self._onSegmentEnd(); });
      ctx.onStop(function () { self.setData({ isPlaying: false }); });
      ctx.onPause(function () { self.setData({ isPlaying: false }); });
      ctx.onError(function () { self.setData({ isPlaying: false }); });

      this._audioContext = ctx;
    },

    _seekToSegment: function (seg) {
      if (!this._audioContext || !seg) return;
      if (seg.startTimeMs) {
        this._audioContext.seek(seg.startTimeMs / 1000);
      }
    },

    // Decide whether to loop, wait for follow-read, advance, or finish playback.
    _onSegmentEnd: function () {
      var seg = this.data.currentSegment;
      if (seg) {
        seg.completed = true;
        this.triggerEvent('segmentcomplete', { index: this.data.currentSegmentIndex, segment: seg });
      }

      if (this.data.loopCurrent) {
        this.playCurrentSegment();
        return;
      }

      if (this.data.followMode) {
        this.setData({ isWaitingFollow: true, isPlaying: false });
        this._startFollowTimer();
        return;
      }

      if (this.data.autoNext) {
        var nextIdx = this.data.currentSegmentIndex + 1;
        if (nextIdx < this.properties.segments.length) {
          this.selectSegment(nextIdx);
          this.playCurrentSegment();
        } else {
          this.setData({ isPlaying: false, isFinished: true });
          this.triggerEvent('completed', {});
        }
      } else {
        this.setData({ isPlaying: false });
      }
    },

    _startFollowTimer: function () {
      var self = this;
      this.clearFollowTimer();
      this._followTimer = setTimeout(function () {
        self.setData({ isWaitingFollow: false });
        if (self.data.autoNext) self.nextSegment();
      }, 10000);
    },

    clearFollowTimer: function () {
      if (this._followTimer) { clearTimeout(this._followTimer); this._followTimer = null; }
    },

    destroyAudio: function () {
      if (this._audioContext) {
        this._audioContext.destroy();
        this._audioContext = null;
        this._currentAudioUrl = '';
      }
    },
  },
});

// Convert milliseconds into the compact mm:ss labels shown in the UI.
function formatTime(ms) {
  var totalSec = Math.floor(ms / 1000);
  var min = Math.floor(totalSec / 60);
  var sec = totalSec % 60;
  return min + ':' + (sec < 10 ? '0' : '') + sec;
}
