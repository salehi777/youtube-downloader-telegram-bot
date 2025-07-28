import 'dotenv/config'
import ytdl from '@distube/ytdl-core'
import fs from 'fs'
import readline from 'readline'
import { createBot } from './lib/create_bot.js'
import { youtubeWithCommandRegex } from './lib/reg.js'
import { downloadStream, getVideoQualities } from './lib/youtube.js'
import { chunkArray, toValidFilename } from './lib/helpers.js'
import { mergeVideoAudio, reEncodeVideo } from './lib/ffmpeg.js'
import { getSelectedQuality, getValidYoutubeUrl } from './lib/terminal.js'

const bot = createBot()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

let skips = {
  skipUrl: false,
  skipInfo: false,
  skipAudio: false,
  skipVideo: false,
  skipMerge: false,
  skipUpload: false,
}

async function main() {
  let url
  if (skips.skipUrl) url = 'https://www.youtube.com/watch?v=yAoLSRbwxL8'
  else url = await getValidYoutubeUrl(rl)

  const videoID = ytdl.getVideoID(url)
  const videoFolder = 'downloaded/' + videoID

  let info

  if (skips.skipInfo)
    info = JSON.parse(fs.readFileSync(`${videoFolder}/info.json`, 'utf8'))
  else {
    console.log('Getting info ...')
    info = await ytdl.getInfo(videoID)
  }
  const title = info.videoDetails.title

  const audioPath = `${videoFolder}/audio.mp4`
  const videoPath = `${videoFolder}/video.mp4`
  const outputPath = `${videoFolder}/${toValidFilename(title)}.mp4`

  fs.mkdirSync(videoFolder, { recursive: true })
  fs.writeFileSync(
    `${videoFolder}/info.json`,
    JSON.stringify(info, null, 2),
    'utf-8'
  )

  const videoItag = await getSelectedQuality(rl, getVideoQualities(info))

  if (!skips.skipAudio) {
    console.log('Downloading Audio ...')
    await downloadStream(info, { quality: 'highestaudio' }, audioPath)
  }

  if (!skips.skipVideo) {
    console.log('Downloading Video ...')
    await downloadStream(info, { quality: videoItag }, videoPath)
  }

  if (!skips.skipMerge) {
    console.log('Merging ...')
    await mergeVideoAudio(audioPath, videoPath, outputPath)
  }

  rl.close()
}

main()
