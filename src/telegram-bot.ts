import 'dotenv/config'
import ytdl, { videoInfo } from '@distube/ytdl-core'
import fs from 'fs'
import { createBot } from './lib/create_bot'
import { youtubeWithCommandRegex } from './lib/reg'
import { downloadStream, getVideoQualities } from './lib/youtube'
import { chunkArray, toValidFilename } from './lib/helpers'
import { mergeVideoAudio, reEncodeVideo } from './lib/ffmpeg'
import TelegramBot from 'node-telegram-bot-api'

const bot = createBot()

// bot events
// calls on any message
bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text as string
  if (text === '/start') return bot.sendMessage(chatId, 'Welcome')
  if (!youtubeWithCommandRegex.test(text))
    bot.sendMessage(chatId, 'Not a valid message')
})

// calls on "command <yt-link>"
bot.onText(youtubeWithCommandRegex, async (msg, match) => {
  if (!match) return
  const command = (match[1] ? match[1] : 'normal').toLowerCase()
  const videoID = match[2]
  const chatId = msg.chat.id
  const videoFolder = 'downloaded/' + videoID

  try {
    switch (command) {
      case 'normal':
        await saveInfo({ chatId, videoID, videoFolder })
        break
      case 'skipinfo':
      case 'reencode':
        break
      default:
        throw new Error('Unknown command')
    }
    await showQualitiesKeyboard({ command, chatId, videoFolder })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    bot.sendMessage(chatId, message)
  }
})

// calls on inline keyboard pressed
bot.on('callback_query', async (callbackQuery) => {
  if (!callbackQuery.message) return
  const chatId = callbackQuery.message.chat.id

  bot.deleteMessage(chatId, callbackQuery.message.message_id)

  const data = callbackQuery.data as string
  const [command, videoFolder, videoItag] = data.split('|')

  try {
    let includes
    switch (command) {
      case 'normal':
      case 'skipinfo':
        includes = {
          audio: true,
          video: true,
          merge: true,
          upload: true,
          reEncode: false,
        }
        break
      case 'reencode':
        includes = {
          audio: false,
          video: false,
          merge: false,
          upload: true,
          reEncode: true,
        }
        break
      default:
        throw new Error('Unknown command')
    }

    await processVideo({
      chatId,
      videoFolder,
      videoItag: Number(videoItag),
      includes,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    bot.sendMessage(chatId, message)
  }
})

// ----------------------------------------------------------------

// get video info and saves it in downloaded/<video-id>/info.json
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

// show inline keyboard with qualities
const showQualitiesKeyboard = async ({
  command,
  chatId,
  videoFolder,
}: showQualitiesKeyboardArgs) => {
  const info = JSON.parse(fs.readFileSync(`${videoFolder}/info.json`, 'utf8'))

  const qualities = getVideoQualities(info)
    .map(([quality, itag]) => [
      { text: quality, callback_data: `${command}|${videoFolder}|${itag}` },
    ])
    .flat()

  await bot.sendMessage(chatId, 'Choose quality', {
    reply_markup: {
      inline_keyboard: chunkArray(qualities, 3),
    },
  })
}

// download audio and video, merge, re-encode and upload
// 1- downloaded/<video-id>/info.json should exist
// 2- some steps can be skipped using "includes"
const processVideo = async ({
  chatId,
  videoFolder,
  videoItag,
  includes,
}: processVideoArgs) => {
  const info: videoInfo = JSON.parse(
    fs.readFileSync(`${videoFolder}/info.json`, 'utf8')
  )
  const title = info.videoDetails.title
  const qualityLabel = info.formats.find(
    ({ itag }) => itag === videoItag
  )?.qualityLabel

  const audioPath = `${videoFolder}/audio.mp4`
  const videoPath = `${videoFolder}/video_${qualityLabel}.mp4`
  const subPath = `${videoFolder}/${toValidFilename(title)}_${qualityLabel}`
  const outputPath = `${subPath}.mp4`
  const outputRePath = `${subPath}_re.mp4`

  const hintMessage = await bot.sendMessage(chatId, 'Starting ...')
  const editHint = (text) => {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: hintMessage.message_id,
    })
  }

  if (includes.audio) {
    editHint('Downloading Audio 0% ...')
    await downloadStream(
      info,
      { quality: 'highestaudio' },
      audioPath,
      (percent) => editHint(`Downloading Audio ${percent}% ...`)
    )
  }

  if (includes.video) {
    editHint('Downloading Video 0% ...')
    await downloadStream(
      info,
      { quality: videoItag },
      videoPath,
      (percent) => editHint(`Downloading Video ${percent}% ...`)
      //
    )
  }

  if (includes.merge) {
    editHint('Merging ...')
    await mergeVideoAudio(audioPath, videoPath, outputPath)
  }

  if (includes.reEncode) {
    editHint('Re-Encoding ...')
    await reEncodeVideo(outputPath, outputRePath)
  }

  if (includes.upload) {
    editHint('Uploading ...')
    const videoStream = fs.createReadStream(
      includes.reEncode ? outputRePath : outputPath
    )
    await bot.sendVideo(chatId, videoStream, {
      caption: title,
    })
  }

  bot.deleteMessage(chatId, hintMessage.message_id)
}

interface saveInfoArgs {
  chatId: TelegramBot.ChatId
  videoID: string
  videoFolder: string
}
interface showQualitiesKeyboardArgs {
  command: string
  chatId: TelegramBot.ChatId
  videoFolder: string
}
interface processVideoArgs {
  chatId: TelegramBot.ChatId
  videoFolder: string
  videoItag: number
  includes: {
    audio?: boolean
    video?: boolean
    merge?: boolean
    upload?: boolean
    reEncode?: boolean
  }
}
