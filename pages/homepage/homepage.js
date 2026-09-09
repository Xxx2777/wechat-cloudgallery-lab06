const db = wx.cloud.database()
const photos = db.collection('photos')

Page({
  data: {
    photoList: [],
    loading: true,
    photoCount: 0,
    totalLikes: 0,
    nickName: '',
    avatarUrl: '',
    location: ''
  },

  onLoad(options) {
    const openid = options.id

    if (!openid) {
      wx.showToast({
        title: '用户信息不存在',
        icon: 'none'
      })
      this.setData({ loading: false })
      return
    }

    photos
      .where({
        _openid: openid
      })
      .orderBy('addDate', 'desc')
      .get({
        success: res => {
          const list = res.data || []
          const first = list[0] || {}
          const totalLikes = list.reduce((sum, item) => {
            return sum + Number(item.likeCount || 0)
          }, 0)

          this.setData({
            photoList: list,
            photoCount: list.length,
            totalLikes,
            nickName: first.nickName || '拾光用户',
            avatarUrl: first.avatarUrl || '',
            location: [first.province, first.country].filter(Boolean).join(' · ') || '拾光社区'
          })

          if (first.nickName) {
            wx.setNavigationBarTitle({
              title: `${first.nickName} 的主页`
            })
          }
        },
        fail: err => {
          console.error('获取个人主页图片失败：', err)
          wx.showToast({
            title: '作品加载失败',
            icon: 'none'
          })
        },
        complete: () => {
          this.setData({ loading: false })
        }
      })
  }
})
