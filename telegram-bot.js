import TelegramBot from 'node-telegram-bot-api'
// import { info } from './temp_files1/bunny_info.js'
import 'dotenv/config'
import ytdl from '@distube/ytdl-core'
import fs from 'fs'
import {
  downloadStream,
  getVideoQualities,
  mergeVideoAudio,
  toValidFilename,
} from './helpers.js'

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

  await bot.sendMessage(chatId, 'start info')
  const info = await ytdl.getInfo(videoID)
  await bot.sendMessage(chatId, 'end info')
  const qualities = getVideoQualities(info)

  const options = {
    reply_markup: {
      inline_keyboard: Object.entries(qualities)
        .reverse()
        .map(([quality, format]) => [
          { text: quality, callback_data: `${videoID}|${format.itag}` },
        ]),
    },
  }
  await bot.sendMessage(chatId, 'Choose quality', options)
})

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id
  const data = callbackQuery.data
  const messageId = callbackQuery.message.message_id
  bot.deleteMessage(chatId, messageId)

  const [videoID, videoItag] = data.split('|')
  await bot.sendMessage(chatId, 'start info')
  const info = await ytdl.getInfo(videoID)
  await bot.sendMessage(chatId, 'end info')
  const title = toValidFilename(info.videoDetails.title)

  if (!fs.existsSync('temp_files')) fs.mkdirSync('temp_files')

  const audioPath = `temp_files/${title}_audio.mp4`
  const vidoePath = `temp_files/${title}_vidoe.mp4`
  const outputPath = `temp_files/${title}.mp4`

  await bot.sendMessage(chatId, 'start audio')
  await downloadStream(info, { quality: 'highestaudio' }, audioPath)
  await bot.sendMessage(chatId, 'end audio')

  await bot.sendMessage(chatId, 'start video')
  await downloadStream(info, { quality: videoItag }, vidoePath)
  await bot.sendMessage(chatId, 'end video')

  await bot.sendMessage(chatId, 'start merge')
  await mergeVideoAudio(audioPath, vidoePath, outputPath)
  await bot.sendMessage(chatId, 'end merge')

  await bot.sendMessage(chatId, 'start send')
  await bot.sendVideo(chatId, outputPath, { caption: title })
  await bot.sendMessage(chatId, 'end send')
})
