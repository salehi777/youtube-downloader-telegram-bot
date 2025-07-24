import TelegramBot from 'node-telegram-bot-api'

export const createBot = () => {
  const botToken = process.env.BOT_TOKEN

  if (!botToken) throw new Error('No bot token provided')

  const bot = new TelegramBot(botToken, { polling: true })

  bot.on('polling_error', (error) =>
    console.log('polling_error,', error.message)
  )

  bot.on('error', (error) => console.log('error,', error.message))

  return bot
}
