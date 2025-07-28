import 'dotenv/config'
import ytdl, { videoInfo } from '@distube/ytdl-core'
import fs from 'fs'
import { createBot } from './lib/create_bot.js'
import { youtubeWithCommandRegex } from './lib/reg.js'
import { downloadStream, getVideoQualities } from './lib/youtube.js'
import {
  chunkArray,
  downloadImage,
  formatFileSize,
  toValidFilename,
} from './lib/helpers.js'
import { mergeVideoAudio, reEncodeVideo } from './lib/ffmpeg.js'
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
      case 'uploadonly':
        break
      default:
        throw new Error('Unknown command')
    }
    await saveThumbnail({ videoFolder })
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
          reEncode: false,
          upload: true,
        }
        break
      case 'reencode':
        includes = {
          audio: false,
          video: false,
          merge: false,
          reEncode: true,
          upload: true,
        }
        break
      case 'uploadonly':
        includes = {
          audio: false,
          video: false,
          merge: false,
          reEncode: false,
          upload: true,
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

// get video thumbnail and saves it in downloaded/<video-id>/thumbnail.jpg
const saveThumbnail = async ({ videoFolder }: saveThumbnailArgs) => {
  const info: videoInfo = JSON.parse(
    fs.readFileSync(`${videoFolder}/info.json`, 'utf8')
  )

  if (!fs.existsSync(`${videoFolder}/thumbnail.jpg`))
    downloadImage(
      info.videoDetails.thumbnails.at(-1)!.url,
      `${videoFolder}/thumbnail.jpg`
    )
}

// show inline keyboard with qualities
const showQualitiesKeyboard = async ({
  command,
  chatId,
  videoFolder,
}: showQualitiesKeyboardArgs) => {
  const info: videoInfo = JSON.parse(
    fs.readFileSync(`${videoFolder}/info.json`, 'utf8')
  )

  const audioContentLength = Number(
    ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
    }).contentLength
  )

  const qualities = getVideoQualities(info)

  const inline_keyboard = qualities.map(({ qualityLabel, itag }) => [
    {
      text: qualityLabel,
      callback_data: `${command}|${videoFolder}|${itag}`,
    },
  ])

  const caption = [
    `<b>${info.videoDetails.title}</b>`,
    '',
    `<b>🕐 ${info.videoDetails.lengthSeconds}s</b>`,
    '',
    ...qualities.map(
      ({ qualityLabel, contentLength }) =>
        `🎥 <b>${qualityLabel}: ${formatFileSize(
          Number(contentLength) + audioContentLength
        )}</b>`
    ),
  ].join('\n')

  await bot.sendPhoto(chatId, info.videoDetails.thumbnails.at(-1)!.url, {
    parse_mode: 'HTML',
    caption,
    reply_markup: {
      inline_keyboard: chunkArray(inline_keyboard.flat(), 3),
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

  // manage board
  const boardMessage = await bot.sendMessage(chatId, 'Starting ...')
  let board: Board = {
    audio: includes.audio ? 'not-started' : 'not-included',
    video: includes.video ? 'not-started' : 'not-included',
    merge: includes.merge ? 'not-started' : 'not-included',
    reEncode: includes.reEncode ? 'not-started' : 'not-included',
    upload: includes.upload ? 'not-started' : 'not-included',
  }
  const editBoard = async (newBoard: Partial<Board>) => {
    board = { ...board, ...newBoard }
    const text = [
      getBoardItemText('Audio', board.audio),
      getBoardItemText('Video', board.video),
      getBoardItemText('Merge', board.merge),
      getBoardItemText('Re-Encode', board.reEncode),
      getBoardItemText('Upload', board.upload),
    ]
      .filter((f) => f)
      .join('\n')
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: boardMessage.message_id,
    })
  }

  if (includes.audio) {
    await editBoard({ audio: 0 })
    await downloadStream(
      info,
      { quality: 'highestaudio' },
      audioPath,
      async (percent) => await editBoard({ audio: percent })
    )
    await editBoard({ audio: 'finished' })
  }

  if (includes.video) {
    await editBoard({ video: 0 })
    await downloadStream(
      info,
      { quality: videoItag },
      videoPath,
      async (percent) => await editBoard({ video: percent })
    )
    await editBoard({ video: 'finished' })
  }

  if (includes.merge) {
    await editBoard({ merge: 'in-progress' })
    await mergeVideoAudio(audioPath, videoPath, outputPath)
    await editBoard({ merge: 'finished' })
  }

  if (includes.reEncode) {
    await editBoard({ reEncode: 'in-progress' })
    await reEncodeVideo(outputPath, outputRePath)
    await editBoard({ reEncode: 'finished' })
  }

  if (includes.upload) {
    await editBoard({ upload: 'in-progress' })
    const videoStream = fs.createReadStream(
      includes.reEncode ? outputRePath : outputPath
    )
    await bot.sendVideo(chatId, videoStream, {
      caption: `${title}\n\n${qualityLabel}${
        includes.reEncode ? ' - Re-Encoded' : ''
      }`,
    })
  }

  await bot.deleteMessage(chatId, boardMessage.message_id)
}

const getBoardItemText = (label: string, item: BoardItem) => {
  if (item === 'not-included') return
  return (
    label +
    ': ' +
    (item === 'not-started'
      ? '⏳'
      : item === 'in-progress'
      ? '🔄'
      : item === 'finished'
      ? '✅'
      : // : item === 'not-included'
        // ? '❌'
        item + '%')
  )
}

interface saveInfoArgs {
  chatId: TelegramBot.ChatId
  videoID: string
  videoFolder: string
}
interface saveThumbnailArgs {
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
    reEncode?: boolean
    upload?: boolean
  }
}
type BoardItem =
  | 'not-started'
  | 'in-progress'
  | 'finished'
  | 'not-included'
  | number
interface Board {
  audio: BoardItem
  video: BoardItem
  merge: BoardItem
  reEncode: BoardItem
  upload: BoardItem
}
