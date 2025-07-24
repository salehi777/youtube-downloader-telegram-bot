import 'dotenv/config'
import ytdl from '@distube/ytdl-core'
import fs from 'fs'
import { createBot } from './lib/create_bot'
import { youtubeWithCommandRegex } from './lib/reg'
import { downloadStream, getVideoQualities } from './lib/youtube'
import { chunkArray, toValidFilename } from './lib/helpers'
import { mergeVideoAudio, reEncodeVideo } from './lib/ffmpeg'
import TelegramBot from 'node-telegram-bot-api'

const bot = createBot()

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text as string
  if (text === '/start') return bot.sendMessage(chatId, 'Welcome')
  if (!youtubeWithCommandRegex.test(text))
    bot.sendMessage(chatId, 'Not a valid message')
})

bot.onText(youtubeWithCommandRegex, async (msg, match) => {
  if (!match) return
  const [_, command, videoID] = match
  const chatId = msg.chat.id
  const videoFolder = 'downloaded/' + videoID

  try {
    switch ((command || '').toLowerCase()) {
      case 'undefined':
        await saveInfo({ chatId, videoID, videoFolder })
        await showQualitiesKeyboard({ chatId, videoFolder })
        break
      case 'reencode':
        processVideo({
          chatId,
          videoFolder,
          includes: {
            includeAudio: false,
            includeVideo: false,
            includeMerge: false,
            includeUpload: true,
            includeReEncode: true,
          },
        })
        break
      case 'skipinfo':
        // todo
        break
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    bot.sendMessage(chatId, message)
  }
})

bot.on('callback_query', async (callbackQuery) => {
  if (!callbackQuery.message) return
  const chatId = callbackQuery.message.chat.id

  bot.deleteMessage(chatId, callbackQuery.message.message_id)

  const data = callbackQuery.data as string
  const [videoFolder, videoItag] = data.split('|')

  try {
    processVideo({
      chatId,
      videoFolder,
      videoItag,
      includes: {
        includeAudio: true,
        includeVideo: true,
        includeMerge: true,
        includeUpload: true,
        includeReEncode: false,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    bot.sendMessage(chatId, message)
  }
})

interface saveInfoArgs {
  chatId: TelegramBot.ChatId
  videoID: string
  videoFolder: string
}
interface showQualitiesKeyboardArgs {
  chatId: TelegramBot.ChatId
  videoFolder: string
}
interface processVideoArgs {
  chatId: TelegramBot.ChatId
  videoFolder: string
  videoItag?: string | number
  includes: {
    includeAudio?: boolean
    includeVideo?: boolean
    includeMerge?: boolean
    includeUpload?: boolean
    includeReEncode?: boolean
  }
}

const saveInfo = async ({ chatId, videoID, videoFolder }: saveInfoArgs) => {
  const { message_id } = await bot.sendMessage(chatId, 'Getting Info ...')

  const info = await ytdl.getInfo(videoID)

  bot.deleteMessage(chatId, message_id)

  if (!fs.existsSync(videoFolder))
    fs.mkdirSync(videoFolder, { recursive: true })
  if (!fs.existsSync(`${videoFolder}/info.json`))
    fs.writeFileSync(
      `${videoFolder}/info.json`,
      JSON.stringify(info, null, 2),
      'utf-8'
    )
}

const showQualitiesKeyboard = async ({
  chatId,
  videoFolder,
}: showQualitiesKeyboardArgs) => {
  const info = JSON.parse(fs.readFileSync(`${videoFolder}/info.json`, 'utf8'))

  const qualities = getVideoQualities(info)
    .map(([quality, itag]) => [
      { text: quality, callback_data: `${videoFolder}|${itag}` },
    ])
    .flat()

  await bot.sendMessage(chatId, 'Choose quality', {
    reply_markup: {
      inline_keyboard: chunkArray(qualities, 3),
    },
  })
}

const processVideo = async ({
  chatId,
  videoFolder,
  videoItag,
  includes,
}: processVideoArgs) => {
  const info = JSON.parse(fs.readFileSync(`${videoFolder}/info.json`, 'utf8'))
  const title = info.videoDetails.title

  const audioPath = `${videoFolder}/audio.mp4`
  const videoPath = `${videoFolder}/video.mp4`
  const outputPath = `${videoFolder}/${toValidFilename(title)}.mp4`
  const outputRePath = `${videoFolder}/${toValidFilename(title)}_reencode.mp4`

  const hintMessage = await bot.sendMessage(chatId, 'Starting ...')
  const editHint = (text) => {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: hintMessage.message_id,
    })
  }

  if (includes.includeAudio) {
    editHint('Downloading Audio 0% ...')
    await downloadStream(
      info,
      { quality: 'highestaudio' },
      audioPath,
      (percent) => editHint(`Downloading Audio ${percent}% ...`)
    )
  }

  if (includes.includeVideo) {
    editHint('Downloading Video 0% ...')
    await downloadStream(
      info,
      { quality: videoItag },
      videoPath,
      (percent) => editHint(`Downloading Video ${percent}% ...`)
      //
    )
  }

  if (includes.includeMerge) {
    editHint('Merging ...')
    await mergeVideoAudio(audioPath, videoPath, outputPath)
  }

  if (includes.includeReEncode) {
    editHint('Re-Encoding ...')
    await reEncodeVideo(outputPath, outputRePath)
  }

  if (includes.includeUpload) {
    editHint('Uploading ...')
    const videoStream = fs.createReadStream(
      includes.includeReEncode ? outputRePath : outputPath
    )
    await bot.sendVideo(chatId, videoStream, {
      caption: title,
    })
  }

  bot.deleteMessage(chatId, hintMessage.message_id)
}
