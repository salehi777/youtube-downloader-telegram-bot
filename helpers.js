import fs from 'fs'
import ytdl from '@distube/ytdl-core'
import ffmpeg from 'ffmpeg-static'
import { spawn } from 'child_process'

// filter audioandvideo/video/videoonly/audio/audioonly/ (format) => {}
// quality highest/lowest/highestaudio/lowestaudio/highestvideo/lowestvideo

export function groupBy(arr, key) {
  return arr.reduce((result, item) => {
    const groupKey = item[key]
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {})
}

export function toValidFilename(str) {
  // Remove or replace invalid characters for both Windows and Linux
  // Windows: <>:"/\|?* and control chars (0-31), Linux: /
  return str
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Windows invalid chars
    .replace(/[\/]/g, '_') // Linux invalid char (redundant for /)
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/^\.+/, '') // Remove leading dots (hidden files)
    .replace(/\.+$/, '') // Remove trailing dots
    .trim()
}

export const getVideoQualities = (info) => {
  let videoFormats = ytdl.filterFormats(info.formats, 'videoonly')
  videoFormats = ytdl.filterFormats(
    videoFormats,
    (format) => format.container === 'mp4'
  )

  let qualities = groupBy(videoFormats, 'qualityLabel')
  qualities = Object.entries(qualities).map(([key, value]) => [
    key,
    ytdl.chooseFormat(value, { quality: 'lowestvideo' }),
  ])
  qualities = Object.fromEntries(qualities)
  return qualities
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

export const mergeVideoAudio = (audioPath, videoPath, outputPath) =>
  new Promise((resolve, reject) => {
    const args = [
      '-i',
      videoPath,
      '-i',
      audioPath,
      '-c:v',
      'copy', // Copy video codec (no re-encoding)
      '-c:a',
      'aac', // Use AAC for audio
      '-shortest', // Finish when shortest stream ends
      '-y', // Overwrite output file
      outputPath,
    ]

    const ffmpegProcess = spawn(ffmpeg, args)

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`merge error ${code}`))
      }
    })

    ffmpegProcess.on('error', reject)
  })
