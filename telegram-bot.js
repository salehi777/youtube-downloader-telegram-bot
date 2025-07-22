import 'dotenv/config'
import ytdl from '@distube/ytdl-core'
import fs from 'fs'
import {
  chunkArray,
  downloadStream,
  getVideoQualities,
  mergeVideoAudio,
  toValidFilename,
  youtubeRegex,
} from './lib/index.js'
import bot from './lib/create_bot.js'

let skips = {
  skipInfo: false,
  skipAudio: false,
  skipVideo: false,
  skipMerge: false,
  skipUpload: false,
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text

  if (text === '/start') return bot.sendMessage(chatId, 'Welcome')

  if (!youtubeRegex.test(text)) bot.sendMessage(chatId, 'Not a valid URL')
})

bot.onText(youtubeRegex, async (msg, match) => {
  const chatId = msg.chat.id
  const url = match[0]
  const videoID = ytdl.getVideoID(url)
  const videoFolder = 'downloaded/' + videoID

  const hintMessage = await bot.sendMessage(chatId, 'Getting Info ...')

  let info

  try {
    if (skips.skipInfo)
      info = JSON.parse(fs.readFileSync(`${videoFolder}/info.json`, 'utf8'))
    else info = await ytdl.getInfo(videoID)

    fs.mkdirSync(videoFolder, { recursive: true })
    fs.writeFileSync(
      `${videoFolder}/info.json`,
      JSON.stringify(info, null, 2),
      'utf-8'
    )

    let qualities = getVideoQualities(info)
    qualities = qualities.map(([quality, itag]) => [
      { text: quality, callback_data: `${videoFolder}|${itag}` },
    ])
    qualities = chunkArray(qualities.flat(), 3)

    await bot.sendMessage(chatId, 'Choose quality', {
      reply_markup: {
        inline_keyboard: qualities,
      },
    })
  } catch (error) {
    console.error(error.message)
    bot.sendMessage(chatId, error.message)
  }

  bot.deleteMessage(chatId, hintMessage.message_id)
})

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id

  bot.deleteMessage(chatId, callbackQuery.message.message_id)

  const data = callbackQuery.data
  const [videoFolder, videoItag] = data.split('|')

  const info = JSON.parse(fs.readFileSync(`${videoFolder}/info.json`, 'utf8'))
  const title = info.videoDetails.title

  const audioPath = `${videoFolder}/audio.mp4`
  const videoPath = `${videoFolder}/video.mp4`
  const outputPath = `${videoFolder}/${toValidFilename(title)}.mp4`

  const hintMessage = await bot.sendMessage(chatId, 'Downloading Audio 0% ...')
  const editHint = (text) => {
    try {
      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: hintMessage.message_id,
      })
    } catch (error) {}
  }

  try {
    if (!skips.skipAudio) {
      await downloadStream(
        info,
        { quality: 'highestaudio' },
        audioPath,
        (percent) => editHint(`Downloading Audio ${percent}% ...`)
      )
    }

    if (!skips.skipVideo) {
      editHint('Downloading Video 0% ...')
      await downloadStream(
        info,
        { quality: videoItag },
        videoPath,
        (percent) => editHint(`Downloading Video ${percent}% ...`)
        //
      )
    }

    if (!skips.skipMerge) {
      editHint('Merging ...')
      await mergeVideoAudio(audioPath, videoPath, outputPath)
    }

    if (!skips.skipUpload) {
      editHint('Uploading ...')
      const videoStream = fs.createReadStream(outputPath)
      await bot.sendVideo(chatId, videoStream, {
        caption: title,
        contentType: 'video/mp4',
      })
    }
  } catch (error) {
    console.error(error.message)
    bot.sendMessage(chatId, error.message)
  }

  bot.deleteMessage(chatId, hintMessage.message_id)
})
