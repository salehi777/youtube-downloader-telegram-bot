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

  const hintMessage = await bot.sendMessage(chatId, 'Getting Info ...')

  let info

  try {
    try {
      info = await ytdl.getInfo(videoID)
      // const infoJson = await fs.readFileSync(`${videoFolder}/info.json`, 'utf8')
      // info = JSON.parse(infoJson)
    } catch (error) {
      bot.sendMessage(chatId, 'Error during getting info')
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
    bot.sendMessage(chatId, error.message)
  }

  bot.deleteMessage(chatId, hintMessage.message_id)
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

  const hintMessage = await bot.sendMessage(chatId, 'Downloading Audio ...')

  try {
    try {
      await downloadStream(info, { quality: 'highestaudio' }, audioPath)
    } catch (error) {
      bot.sendMessage(chatId, 'Error during aduio download')
      throw error
    }

    try {
      await bot.editMessageText('Downloading Video ...', {
        chat_id: chatId,
        message_id: hintMessage.message_id,
      })
      await downloadStream(info, { quality: videoItag }, videoPath)
    } catch (error) {
      bot.sendMessage(chatId, 'Error during video download')
      throw error
    }

    try {
      await bot.editMessageText('Merging ...', {
        chat_id: chatId,
        message_id: hintMessage.message_id,
      })
      await mergeVideoAudio(audioPath, videoPath, outputPath)
    } catch (error) {
      bot.sendMessage(chatId, 'Error during merge')
      throw error
    }

    try {
      await bot.editMessageText('Uploading ...', {
        chat_id: chatId,
        message_id: hintMessage.message_id,
      })
      await bot.sendVideo(chatId, outputPath, {
        caption: info.videoDetails.title,
        contentType: 'video/mp4',
      })
    } catch (error) {
      bot.sendMessage(chatId, 'Error during upload to telegram')
      throw error
    }
  } catch (error) {
    console.error(error.message)
    bot.sendMessage(chatId, error.message)
  }

  bot.deleteMessage(chatId, hintMessage.message_id)
})
