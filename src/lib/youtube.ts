import fs from 'fs'
import ytdl, { downloadOptions, videoInfo } from '@distube/ytdl-core'
import { groupBy } from './helpers.js'

// filter audioandvideo/video/videoonly/audio/audioonly/ (format) => {}
// quality highest/lowest/highestaudio/lowestaudio/highestvideo/lowestvideo

export const getVideoQualities = (info: videoInfo) => {
  let videoFormats = ytdl.filterFormats(info.formats, 'videoonly')
  videoFormats = ytdl.filterFormats(
    videoFormats,
    (format) => format.container === 'mp4'
  )

  const qualitiesGrouped = groupBy(videoFormats, 'qualityLabel')

  const qualities = Object.entries(qualitiesGrouped).map(([key, value]) =>
    ytdl.chooseFormat(value, { quality: 'lowestvideo' })
  )
  return qualities.reverse()
}

export const downloadStream = (
  info: videoInfo,
  options: downloadOptions,
  filename: string,
  onProgress?: (percnet: number) => void
) =>
  new Promise((resolve, reject) => {
    const stream = ytdl.downloadFromInfo(info, options)
    const writeStream = fs.createWriteStream(filename)

    stream.pipe(writeStream)

    let lastProgressTime = 0 // this get used to make sure each onProgress get called with 5s between
    stream.on('progress', (_, downloaded, total) => {
      if (!onProgress) return
      const now = Date.now()
      if (now - lastProgressTime >= 5000 || downloaded === total) {
        onProgress(Math.round((downloaded / total) * 100))
        lastProgressTime = now
      }
    })

    writeStream.on('finish', () => {
      resolve(null)
    })

    stream.on('error', reject)
    writeStream.on('error', reject)
  })
