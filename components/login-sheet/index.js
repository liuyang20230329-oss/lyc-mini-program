// File overview: components\login-sheet\index.js
// Lightweight bottom sheet for login-required scenarios.
Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    body: { type: String, value: '' },
    primaryText: { type: String, value: '微信一键登录' },
    secondaryText: { type: String, value: '稍后再说' }
  },

  methods: {
    handleConfirm: function () {
      this.triggerEvent('confirm');
    },

    handleCancel: function () {
      this.triggerEvent('cancel');
    },

    handleOverlayTap: function () {
      this.triggerEvent('close');
    }
  }
});
