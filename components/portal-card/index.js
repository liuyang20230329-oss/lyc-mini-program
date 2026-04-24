// File overview: components\portal-card\index.js
// Category card used as the home page entry grid.
Component({
  properties: {
    item: { type: Object, value: null }
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
