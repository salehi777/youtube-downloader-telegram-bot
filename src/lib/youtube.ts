import fs from 'fs'
import ytdl from '@distube/ytdl-core'
import { groupBy } from './helpers.js'

// filter audioandvideo/video/videoonly/audio/audioonly/ (format) => {}
// quality highest/lowest/highestaudio/lowestaudio/highestvideo/lowestvideo

export const getVideoQualities = (info) => {
  let videoFormats = ytdl.filterFormats(info.formats, 'videoonly')
  videoFormats = ytdl.filterFormats(
    videoFormats,
    (format) => format.container === 'mp4'
  )

  let qualities = groupBy(videoFormats, 'qualityLabel')
  qualities = Object.entries(qualities).map(([key, value]) => [
    key,
    ytdl.chooseFormat(value, { quality: 'lowestvideo' }).itag
  ])
  return qualities.reverse()
}

export const downloadStream = (info, options, filename, onProgress) =>
  new Promise((resolve, reject) => {
    const stream = ytdl.downloadFromInfo(info, options)
    const writeStream = fs.createWriteStream(filename)

    stream.pipe(writeStream)

    let lastProgressTime = 0 // this get used to make sure each onProgress get called with 5s between
    stream.on('progress', (_, downloaded, total) => {
      if (!onProgress) return
      const now = Date.now()
      if (now - lastProgressTime >= 5000 || downloaded === total) {
        onProgress(((downloaded / total) * 100).toFixed(2))
        lastProgressTime = now
      }
    })

    writeStream.on('finish', () => {
      resolve()
    })

    stream.on('error', reject)
    writeStream.on('error', reject)
  })
