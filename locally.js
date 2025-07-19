import 'dotenv/config'
import ytdl from '@distube/ytdl-core'
import fs from 'fs'
import {
  downloadStream,
  getVideoQualities,
  mergeVideoAudio,
  toValidFilename,
} from './helpers.js'
import { info } from './temp_files1/bunny_info.js'

// quality highest/lowest/highestaudio/lowestaudio/highestvideo/lowestvideo
// filter audioandvideo/video/videoonly/audio/audioonly/ (format) => format.container === 'mp4'

// const url = 'https://www.youtube.com/watch?v=EngW7tLk6R8'
// const info = await ytdl.getInfo(url)
// console.log(info)

// const qualities = getVideoQualities(info)

// console.log(Object.keys(qualities))

// const videoItag = qualities['144p'].itag
const title = toValidFilename(info.videoDetails.title)
console.log(title)

// if (!fs.existsSync('temp_files')) fs.mkdirSync('temp_files')

const audioPath = `temp_files/${title}_audio.mp4`
const vidoePath = `temp_files/${title}_vidoe.mp4`
const outputPath = `temp_files/${title}.mp4`

console.log('start audio')
await downloadStream(info, { quality: 'highestaudio' }, audioPath)
// console.log('end audio')

// console.log('start video')
// await downloadStream(info, { quality: videoItag }, vidoePath)
// console.log('end video')

// console.log('start merge')
// await mergeVideoAudio(audioPath, vidoePath, outputPath)
// console.log('end merge')
