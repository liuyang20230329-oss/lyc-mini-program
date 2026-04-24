// File overview: components\video-player\index.js
// Video player keeps the active transcript segment aligned with current playback time.
Component({
  properties: {
    videoUrl: { type: String, value: '' },
    segments: { type: Array, value: [] },
    autoPlay: { type: Boolean, value: false },
    loop: { type: Boolean, value: false },
    muted: { type: Boolean, value: false },
    showControls: { type: Boolean, value: true },
    showFullscreen: { type: Boolean, value: true },
    showPlayBtn: { type: Boolean, value: true },
    showCenterPlayBtn: { type: Boolean, value: true },
    videoHeight: { type: Number, value: 420 },
  },

  data: {
    activeSegmentIndex: -1,
    currentSegment: null,
  },

  lifetimes: {
    attached: function () {
      this._videoContext = null;
    },
    ready: function () {
      this._videoContext = wx.createVideoContext('lycVideo', this);
    },
    detached: function () {
      this._videoContext = null;
    },
  },

  methods: {
    // Let the learner jump directly to a segment chip in the timeline.
    jumpToSegment: function (e) {
      var index = e.currentTarget.dataset.index;
      var seg = this.properties.segments[index];
      if (!seg || !this._videoContext) return;

      this.setData({ activeSegmentIndex: index, currentSegment: seg });

      if (seg.startTimeMs) {
        this._videoContext.seek(seg.startTimeMs / 1000);
      }
      this._videoContext.play();
    },

    onPlay: function () {
      this.triggerEvent('play');
    },

    onPause: function () {
      this.triggerEvent('pause');
    },

    onEnded: function () {
      this.triggerEvent('ended');
    },

    onTimeUpdate: function (e) {
      var currentMs = (e.detail.currentTime || 0) * 1000;
      var segments = this.properties.segments;
      if (!segments || segments.length === 0) return;

      for (var i = segments.length - 1; i >= 0; i--) {
        var seg = segments[i];
        var startMs = seg.startTimeMs || 0;
        var endMs = seg.endTimeMs || startMs + 60000;
        if (currentMs >= startMs && currentMs < endMs) {
          if (this.data.activeSegmentIndex !== i) {
            this.setData({ activeSegmentIndex: i, currentSegment: seg });
            this.triggerEvent('segmentchange', { index: i, segment: seg });
          }
          break;
        }
      }
    },

    onError: function (e) {
      this.triggerEvent('error', e.detail);
    },

    onLoaded: function (e) {
      this.triggerEvent('loaded', e.detail);
    },

    seekTo: function (position) {
      if (this._videoContext) this._videoContext.seek(position);
    },

    play: function () {
      if (this._videoContext) this._videoContext.play();
    },

    pause: function () {
      if (this._videoContext) this._videoContext.pause();
    },

    stop: function () {
      if (this._videoContext) this._videoContext.stop();
    },
  },
});
