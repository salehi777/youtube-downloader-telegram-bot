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
    try {
      // info = await ytdl.getInfo(videoID)
      const infoJson = await fs.readFileSync(`${videoFolder}/info.json`, 'utf8')
      info = JSON.parse(infoJson)
    } catch (error) {
      bot.sendMessage(chatId, 'Error during getting info')
      throw error
    }

    // if (fs.existsSync(videoFolder))
    //   fs.rmSync(videoFolder, { recursive: true, force: true })
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

  const infoJson = await fs.readFileSync(videoFolder + '/info.json', 'utf8')
  const info = JSON.parse(infoJson)

  const audioPath = `${videoFolder}/audio.mp4`
  const videoPath = `${videoFolder}/video.mp4`
  const outputPath = `${videoFolder}/${toValidFilename(
    info.videoDetails.title
  )}.mp4`

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
    try {
      await downloadStream(
        info,
        { quality: 'highestaudio' },
        audioPath,
        (percent) => editHint(`Downloading Audio ${percent}% ...`)
      )
    } catch (error) {
      bot.sendMessage(chatId, 'Error during aduio download')
      throw error
    }

    try {
      editHint('Downloading Video 0% ...')
      await downloadStream(
        info,
        { quality: videoItag },
        videoPath,
        (percent) => editHint(`Downloading Video ${percent}% ...`)
        //
      )
    } catch (error) {
      bot.sendMessage(chatId, 'Error during video download')
      throw error
    }

    try {
      editHint('Merging ...')
      await mergeVideoAudio(audioPath, videoPath, outputPath)
    } catch (error) {
      bot.sendMessage(chatId, 'Error during merge')
      throw error
    }

    try {
      editHint('Uploading ...')
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
