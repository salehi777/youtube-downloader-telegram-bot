import ytdl from '@distube/ytdl-core'
import fs from 'fs'
import {
  downloadStream,
  getVideoQualities,
  mergeVideoAudio,
  toValidFilename,
} from './helpers.js'
import TelegramBot from 'node-telegram-bot-api'
import 'dotenv/config'

// import { info } from './temp_files1/bunny_info.js'

const botToken = process.env.BOT_TOKEN
const bot = new TelegramBot(botToken, { polling: true })
bot.on('polling_error', (error) => console.log('polling_error,', error.message))
bot.on('error', (error) => console.log('error,', error.message))

const youtubeRegex =
  /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text
  if (!youtubeRegex.test(text)) bot.sendMessage(chatId, 'Not a valid URL')
})

bot.onText(youtubeRegex, async (msg, match) => {
  const chatId = msg.chat.id
  const url = match[0]
  const videoID = ytdl.getVideoID(url)
  const videoFolder = 'downloaded/' + videoID

  try {
    try {
      await bot.sendMessage(chatId, 'start info')
      const info = await ytdl.getInfo(videoID)
      await bot.sendMessage(chatId, 'end info')
    } catch (error) {
      bot.sendMessage('Error during getting info', error.message)
      throw error
    }

    if (fs.existsSync(videoFolder))
      fs.rmSync(videoFolder, { recursive: true, force: true })
    fs.mkdirSync(videoFolder, { recursive: true })

    fs.writeFileSync(
      `${videoFolder}/info.json`,
      JSON.stringify(info, null, 2),
      'utf-8'
    )

    const qualities = getVideoQualities(info)

    const options = {
      reply_markup: {
        inline_keyboard: Object.entries(qualities)
          .reverse()
          .map(([quality, format]) => [
            { text: quality, callback_data: `${videoFolder}|${format.itag}` },
          ]),
      },
    }
    await bot.sendMessage(chatId, 'Choose quality', options)
  } catch (error) {
    console.error(error.message)
  }
})

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id

  bot.deleteMessage(chatId, callbackQuery.message.message_id)

  const data = callbackQuery.data
  const [videoFolder, videoItag] = data.split('|')

  const audioPath = `${videoFolder}/audio.mp4`
  const videoPath = `${videoFolder}/video.mp4`
  const outputPath = `${videoFolder}/final.mp4`

  const infoJson = await fs.readFileSync(videoFolder + '/info.json', 'utf8')
  const info = JSON.parse(infoJson)

  try {
    try {
      await bot.sendMessage(chatId, 'start audio')
      await downloadStream(info, { quality: 'highestaudio' }, audioPath)
      await bot.sendMessage(chatId, 'end audio')
    } catch (error) {
      bot.sendMessage('Error during aduio download', error.message)
      throw error
    }

    try {
      await bot.sendMessage(chatId, 'start video')
      await downloadStream(info, { quality: videoItag }, videoPath)
      await bot.sendMessage(chatId, 'end video')
    } catch (error) {
      bot.sendMessage('Error during video download', error.message)
      throw error
    }

    try {
      await bot.sendMessage(chatId, 'start merge')
      await mergeVideoAudio(audioPath, videoPath, outputPath)
      await bot.sendMessage(chatId, 'end merge')
    } catch (error) {
      bot.sendMessage('Error during merge', error.message)
      throw error
    }

    try {
      await bot.sendMessage(chatId, 'start send')
      await bot.sendVideo(chatId, outputPath, {
        caption: info.videoDetails.title,
        contentType: 'video/mp4',
      })
      await bot.sendMessage(chatId, 'end send')
    } catch (error) {
      bot.sendMessage('Error during upload to telegram', error.message)
      throw error
    }
  } catch (error) {
    console.error(error.message)
  }
})
