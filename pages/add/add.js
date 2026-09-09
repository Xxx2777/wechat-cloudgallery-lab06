const db = wx.cloud.database()
const photos = db.collection('photos')
const app = getApp()
const MAX_IMAGES = 9

function formatDate() {
  const now = new Date()
  const year = now.getFullYear()
  let month = now.getMonth() + 1
  let day = now.getDate()
  if (month < 10) month = `0${month}`
  if (day < 10) day = `0${day}`
  return `${year}-${month}-${day}`
}

function formatFileSize(size) {
  if (!size) return ''
  if (size > 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

Page({
  data: {
    pendingImages: [],
    caption: '',
    publishing: false,
    userNick: '拾光用户',
    userAvatar: ''
  },

  onLoad() {
    this.syncIdentity()
    this.ensureOpenid()
  },

  onShow() {
    this.syncIdentity()
  },

  syncIdentity() {
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      userNick: userInfo.nickName || '拾光用户',
      userAvatar: userInfo.avatarUrl || ''
    })
  },

  ensureOpenid() {
    if (app.globalData.openid) return

    wx.cloud.callFunction({
      name: 'getOpenid',
      success: res => {
        if (res.result && res.result.openid) {
          app.globalData.openid = res.result.openid
          wx.setStorageSync('shiguang_openid', res.result.openid)
        }
      },
      fail: err => {
        console.error('获取 openid 失败：', err)
      }
    })
  },

  chooseImage() {
    const remain = MAX_IMAGES - this.data.pendingImages.length
    if (remain <= 0) {
      wx.showToast({ title: '最多选择 9 张', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const added = res.tempFiles.map(file => ({
          tempFilePath: file.tempFilePath,
          sizeText: formatFileSize(file.size)
        }))
        this.setData({
          pendingImages: this.data.pendingImages.concat(added).slice(0, MAX_IMAGES)
        })
      },
      fail: err => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          console.error('选择图片失败：', err)
        }
      }
    })
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const pendingImages = this.data.pendingImages.slice()
    if (index >= 0 && index < pendingImages.length) {
      pendingImages.splice(index, 1)
      this.setData({ pendingImages })
    }
  },

  clearImages() {
    this.setData({
      pendingImages: [],
      caption: ''
    })
  },

  onCaptionInput(e) {
    this.setData({ caption: e.detail.value })
  },

  publish() {
    if (!this.data.pendingImages.length || this.data.publishing) return

    this.setData({ publishing: true })
    this.ensureOpenid()
    this.uploadAll(0)
  },

  uploadAll(index) {
    const images = this.data.pendingImages
    if (index >= images.length) {
      this.finishPublish()
      return
    }

    const filePath = images[index].tempFilePath
    const suffixMatch = filePath.match(/\.([a-zA-Z0-9]+)$/)
    const suffix = suffixMatch ? `.${suffixMatch[1]}` : '.jpg'
    const cloudPath = `gallery/${Date.now()}-${Math.floor(Math.random() * 1000000)}${suffix}`
    const caption = (this.data.caption || '').trim()

    wx.showLoading({
      title: `发布中 ${index + 1}/${images.length}`,
      mask: true
    })

    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: uploadRes => {
        const userInfo = app.globalData.userInfo || {}

        photos.add({
          data: {
            photoUrl: uploadRes.fileID,
            avatarUrl: userInfo.avatarUrl || '',
            nickName: userInfo.nickName || '拾光用户',
            country: userInfo.country || '未知',
            province: userInfo.province || '未知',
            caption: caption || '分享了一张好看的图片',
            addDate: formatDate(),
            createTime: Date.now(),
            likeCount: 0,
            openid: app.globalData.openid || ''
          },
          success: () => {
            this.uploadAll(index + 1)
          },
          fail: err => {
            console.error('写入云数据库失败：', err)
            wx.hideLoading()
            wx.showToast({ title: '记录保存失败', icon: 'none' })
            this.setData({ publishing: false })
            wx.cloud.deleteFile({ fileList: [uploadRes.fileID], fail: () => {} })
          }
        })
      },
      fail: err => {
        console.error('上传云存储失败：', err)
        wx.hideLoading()
        wx.showToast({ title: '发布失败', icon: 'none' })
        this.setData({ publishing: false })
      }
    })
  },

  finishPublish() {
    wx.hideLoading()
    wx.showToast({ title: '发布成功', icon: 'success' })
    this.setData({
      pendingImages: [],
      caption: '',
      publishing: false
    })

    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' })
    }, 900)
  }
})
