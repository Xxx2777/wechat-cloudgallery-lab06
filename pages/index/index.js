const db = wx.cloud.database()
const photos = db.collection('photos')
const app = getApp()

function normalizePhoto(item) {
  const liked = !!wx.getStorageSync(`like_${item._id}`)
  return Object.assign({}, item, {
    caption: item.caption || '',
    likeCount: Number(item.likeCount || 0),
    createTime: Number(item.createTime || 0),
    liked,
    publishText: formatPublishTime(item)
  })
}

function formatPublishTime(item) {
  const ts = Number(item.createTime)
  if (ts) {
    const d = new Date(ts)
    const p = n => (n < 10 ? `0${n}` : `${n}`)
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }
  return item.addDate || ''
}

function photoTime(item) {
  if (item.createTime) return item.createTime
  const dateText = String(item.addDate || '')
  const parts = dateText.split(/[-.]/).map(Number)
  if (parts.length === 3 && parts.every(v => !isNaN(v))) {
    return new Date(parts[0], parts[1] - 1, parts[2]).getTime()
  }
  return 0
}

Page({
  data: {
    photoList: [],
    skeletons: [1, 2],
    loading: true,
    userNick: '',
    userAvatar: ''
  },

  onShow() {
    this.syncUserInfo()
    this.refreshList()
  },

  onPullDownRefresh() {
    this.refreshList(() => {
      wx.stopPullDownRefresh()
    })
  },

  syncUserInfo() {
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      userNick: userInfo.nickName || '',
      userAvatar: userInfo.avatarUrl || ''
    })
  },

  refreshList(done) {
    this.setData({ loading: true })

    photos.orderBy('addDate', 'desc').get({
      success: res => {
        const list = (res.data || [])
          .map(normalizePhoto)
          .sort((a, b) => photoTime(b) - photoTime(a))

        this.setData({
          photoList: list
        })
      },
      fail: err => {
        console.error('获取图片列表失败：', err)
        wx.showToast({
          title: '作品加载失败',
          icon: 'none'
        })
      },
      complete: () => {
        this.setData({ loading: false })
        if (done) done()
      }
    })
  },

  goToAdd() {
    wx.switchTab({ url: '/pages/add/add' })
  },

  goCreate() {
    wx.switchTab({ url: '/pages/add/add' })
  },

  goMine() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `../detail/detail?id=${id}`
    })
  },

  likePhoto(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.photoList[index]
    if (!item) return

    const liked = !item.liked
    const likeCount = Math.max(0, Number(item.likeCount || 0) + (liked ? 1 : -1))

    this.setData({
      [`photoList[${index}].liked`]: liked,
      [`photoList[${index}].likeCount`]: likeCount
    })
    wx.setStorageSync(`like_${item._id}`, liked ? 1 : 0)

    wx.showToast({
      title: liked ? '已点赞' : '已取消点赞',
      icon: 'none',
      duration: 900
    })

    photos.doc(item._id).update({
      data: {
        likeCount
      },
      fail: err => {
        console.warn('点赞同步失败：', err)
      }
    })
  },

})
