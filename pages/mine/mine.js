const db = wx.cloud.database()
const photos = db.collection('photos')
const app = getApp()

Page({
  data: {
    openid: '',
    editNick: '拾光用户',
    editAvatar: '',
    photoList: [],
    photoCount: 0,
    totalLikes: 0,
    loading: true,
    manageMode: false
  },

  onShow() {
    this.syncIdentity()
    this.ensureOpenid(() => {
      this.loadMyPhotos()
    })
  },

  onPullDownRefresh() {
    this.syncIdentity()
    this.ensureOpenid(() => {
      this.loadMyPhotos(() => {
        wx.stopPullDownRefresh()
      })
    })
  },

  syncIdentity() {
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      editNick: userInfo.nickName || '拾光用户',
      editAvatar: userInfo.avatarUrl || ''
    })
  },

  ensureOpenid(callback) {
    if (app.globalData.openid) {
      this.setData({ openid: app.globalData.openid })
      if (callback) callback()
      return
    }

    wx.cloud.callFunction({
      name: 'getOpenid',
      success: res => {
        if (res.result && res.result.openid) {
          app.globalData.openid = res.result.openid
          wx.setStorageSync('shiguang_openid', res.result.openid)
          this.setData({ openid: res.result.openid })
        }
        if (callback) callback()
      },
      fail: err => {
        console.error('获取 openid 失败：', err)
        this.setData({ loading: false })
      }
    })
  },

  loadMyPhotos(done) {
    const openid = app.globalData.openid
    if (!openid) {
      this.setData({ loading: false })
      if (done) done()
      return
    }

    this.setData({ loading: true })

    photos
      .where({ _openid: openid })
      .orderBy('addDate', 'desc')
      .get({
        success: res => {
          const list = res.data || []
          const totalLikes = list.reduce((sum, item) => {
            return sum + Number(item.likeCount || 0)
          }, 0)
          this.setData({
            photoList: list,
            photoCount: list.length,
            totalLikes
          })
        },
        fail: err => {
          console.error('获取我的作品失败：', err)
        },
        complete: () => {
          this.setData({ loading: false })
          if (done) done()
        }
      })
  },

  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return

    wx.showLoading({ title: '头像处理中', mask: true })
    const suffixMatch = tempPath.match(/\.([a-zA-Z0-9]+)$/)
    const suffix = suffixMatch ? `.${suffixMatch[1]}` : '.png'

    wx.cloud.uploadFile({
      cloudPath: `avatars/${Date.now()}${suffix}`,
      filePath: tempPath,
      success: res => {
        this.setData({ editAvatar: res.fileID })
        this.saveProfile(this.data.editNick, res.fileID)
        wx.hideLoading()
        wx.showToast({ title: '头像已更新', icon: 'success' })
      },
      fail: err => {
        console.error('头像上传失败：', err)
        wx.hideLoading()
        wx.showToast({ title: '头像上传失败', icon: 'none' })
      }
    })
  },

  onNickInput(e) {
    this.setData({ editNick: e.detail.value })
  },

  saveNickname() {
    const nickName = (this.data.editNick || '').trim() || '拾光用户'
    this.setData({ editNick: nickName })
    this.saveProfile(nickName, this.data.editAvatar)
    wx.showToast({ title: '昵称已保存', icon: 'success' })
  },

  saveProfile(nickName, avatarUrl) {
    const current = app.globalData.userInfo || {}
    app.globalData.userInfo = Object.assign({}, current, {
      nickName,
      avatarUrl: avatarUrl || current.avatarUrl || ''
    })
    wx.setStorageSync('shiguang_user', app.globalData.userInfo)
  },

  toggleManage() {
    this.setData({ manageMode: !this.data.manageMode })
  },

  deleteHistoryPhoto(e) {
    const id = e.currentTarget.dataset.id
    const url = e.currentTarget.dataset.url
    if (!id) return

    wx.showModal({
      title: '删除这张作品？',
      content: '删除后图片与作品记录都会移除，无法恢复。',
      confirmText: '删除',
      confirmColor: '#e3504a',
      success: res => {
        if (res.confirm) this.removePhoto(id, url)
      }
    })
  },

  removePhoto(id, url) {
    wx.showLoading({ title: '删除中', mask: true })
    photos.doc(id).remove({
      success: () => {
        if (url) {
          wx.cloud.deleteFile({ fileList: [url], fail: () => {} })
        }
        wx.hideLoading()
        wx.showToast({ title: '已删除', icon: 'success' })
        this.setData({ manageMode: false })
        this.loadMyPhotos()
      },
      fail: err => {
        console.error('删除作品失败：', err)
        wx.hideLoading()
        wx.showToast({ title: '删除失败', icon: 'none' })
      }
    })
  },

  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ urls: [url], current: url })
  },

  goPublicProfile() {
    const openid = app.globalData.openid
    if (!openid) {
      wx.showToast({ title: '正在获取用户信息', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/homepage/homepage?id=${openid}`
    })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  goCreate() {
    wx.reLaunch({ url: '/pages/add/add' })
  }
})
