const db = wx.cloud.database()
const photos = db.collection('photos')
const commentsDb = db.collection('comments')
const app = getApp()

function formatPublishTime(item) {
  const ts = Number(item.createTime)
  if (ts) {
    const d = new Date(ts)
    const p = n => (n < 10 ? `0${n}` : `${n}`)
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }
  return item.addDate || ''
}

Page({
  data: {
    photo: null,
    comments: [],
    commentText: '',
    liked: false,
    loading: true
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({
        title: '作品不存在',
        icon: 'none'
      })
      this.setData({ loading: false })
      return
    }

    photos.doc(options.id).get({
      success: res => {
        this.setData({
          liked: !!wx.getStorageSync(`like_${res.data._id}`),
          photo: Object.assign({}, res.data, {
            caption: res.data.caption || '分享了一张好看的图片',
            likeCount: Number(res.data.likeCount || 0),
            publishText: formatPublishTime(res.data)
          })
        })
        this.loadComments(res.data._id)
      },
      fail: err => {
        console.error('获取作品详情失败：', err)
        wx.showToast({
          title: '作品加载失败',
          icon: 'none'
        })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  loadComments(photoId) {
    commentsDb
      .where({ photoId })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get({
        success: res => {
          this.setData({
            comments: res.data || []
          })
        },
        fail: err => {
          console.warn('读取评论失败，请确认已创建 comments 集合：', err)
          this.setData({ comments: [] })
        }
      })
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  submitComment() {
    const content = (this.data.commentText || '').trim()
    const photo = this.data.photo
    if (!content || !photo) return

    const userInfo = app.globalData.userInfo || {}
    commentsDb
      .add({
        data: {
          photoId: photo._id,
          nickName: userInfo.nickName || '拾光用户',
          avatarUrl: userInfo.avatarUrl || '',
          content,
          createTime: Date.now()
        }
      })
      .then(() => {
        this.setData({ commentText: '' })
        wx.showToast({ title: '评论成功', icon: 'success' })
        this.loadComments(photo._id)
      })
      .catch(err => {
        console.error('评论发送失败：', err)
        wx.showToast({ title: '评论发送失败', icon: 'none' })
      })
  },

  likePhoto() {
    const photo = this.data.photo
    if (!photo) return

    const liked = !this.data.liked
    const likeCount = Math.max(0, Number(photo.likeCount || 0) + (liked ? 1 : -1))

    this.setData({
      liked,
      'photo.likeCount': likeCount
    })
    wx.setStorageSync(`like_${photo._id}`, liked ? 1 : 0)

    wx.showToast({
      title: liked ? '已点赞' : '已取消点赞',
      icon: 'none',
      duration: 900
    })

    photos.doc(photo._id).update({
      data: {
        likeCount
      },
      fail: err => {
        console.warn('点赞同步失败：', err)
      }
    })
  },

  downloadPhoto() {
    if (!this.data.photo || !this.data.photo.photoUrl) return

    wx.showLoading({
      title: '保存中',
      mask: true
    })

    wx.cloud.downloadFile({
      fileID: this.data.photo.photoUrl,
      success: res => {
        this.saveToAlbum(res.tempFilePath)
      },
      fail: err => {
        console.error('下载图片失败：', err)
        wx.hideLoading()
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        })
      }
    })
  },

  saveToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        wx.hideLoading()
        wx.showToast({
          title: '已保存到相册',
          icon: 'success'
        })
      },
      fail: err => {
        console.error('保存图片失败：', err)
        wx.hideLoading()

        const message = err.errMsg || ''
        if (message.indexOf('auth') > -1 || message.indexOf('deny') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '开启相册权限后即可保存作品图片',
            confirmText: '去设置',
            success: res => {
              if (res.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          })
        }
      }
    })
  },

  previewPhoto() {
    if (!this.data.photo || !this.data.photo.photoUrl) return

    wx.previewImage({
      urls: [this.data.photo.photoUrl],
      current: this.data.photo.photoUrl
    })
  },

  onShareAppMessage() {
    const id = this.data.photo ? this.data.photo._id : ''

    return {
      title: this.data.photo && this.data.photo.caption ? this.data.photo.caption : '给你分享一张好看的图片',
      path: `/pages/detail/detail?id=${id}`
    }
  }
})
