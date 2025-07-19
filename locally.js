import 'dotenv/config'
import ytdl from '@distube/ytdl-core'
import fs from 'fs'
import {
  downloadStream,
  getVideoQualities,
  mergeVideoAudio,
  toValidFilename,
} from './helpers.js'

// import { info } from './downloaded/bunny_info.js'

const url = 'https://www.youtube.com/watch?v=EngW7tLk6R8'
const videoID = ytdl.getVideoID(url)
const videoFolder = 'downloaded/' + videoID

let startTime

startTime = Date.now()
console.log('start info')
const info = await ytdl.getInfo(videoID)
console.log('end info', ((Date.now() - startTime) / 1000).toFixed(2))

if (fs.existsSync(videoFolder))
  fs.rmSync(videoFolder, { recursive: true, force: true })
fs.mkdirSync(videoFolder, { recursive: true })

fs.writeFileSync(
  `${videoFolder}/info.json`,
  JSON.stringify(info, null, 2),
  'utf-8'
)

const audioPath = `${videoFolder}/audio.mp4`
const vidoePath = `${videoFolder}/vidoe.mp4`
const outputPath = `${videoFolder}/final.mp4`

startTime = Date.now()
console.log('start audio')
await downloadStream(info, { quality: 'highestaudio' }, audioPath)
console.log('end audio', ((Date.now() - startTime) / 1000).toFixed(2))

startTime = Date.now()
console.log('start video')
await downloadStream(info, { quality: 'lowestvideo' }, vidoePath)
console.log('end video', ((Date.now() - startTime) / 1000).toFixed(2))

startTime = Date.now()
console.log('start merge')
await mergeVideoAudio(audioPath, vidoePath, outputPath)
console.log('end merge', ((Date.now() - startTime) / 1000).toFixed(2))
