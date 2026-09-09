const cloudEnv = 'cloud1-d3gqm44c5fecc4b39'

App({
  onLaunch() {
    const cachedUser = wx.getStorageSync('shiguang_user')
    const cachedOpenid = wx.getStorageSync('shiguang_openid')
    if (cachedUser) this.globalData.userInfo = cachedUser
    if (cachedOpenid) this.globalData.openid = cachedOpenid

    if (!wx.cloud) {
      console.error('请使用支持云开发的微信开发者工具基础库运行本项目')
      return
    }

    const initOptions = { traceUser: true }
    if (cloudEnv) {
      initOptions.env = cloudEnv
    }

    wx.cloud.init(initOptions)
  },

  globalData: {
    userInfo: null,
    openid: null
  }
})
