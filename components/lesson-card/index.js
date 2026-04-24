// File overview: components\lesson-card\index.js
// Reusable lesson summary card used in lists, shelves, and recommendations.
Component({
  properties: {
    item: { type: Object, value: null },
    mode: { type: String, value: 'default' }
  },

  data: {
    isCompact: false
  },

  observers: {
    'mode': function (mode) {
      this.setData({
        isCompact: mode === 'compact'
      });
    }
  },

  methods: {
    handleTap: function () {
      var item = this.properties.item;
      if (item) {
        this.triggerEvent('select', item);
      }
    }
  }
});
