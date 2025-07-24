import TelegramBot from 'node-telegram-bot-api'

const botToken = process.env.BOT_TOKEN
const bot = new TelegramBot(botToken, { polling: true })
bot.on('polling_error', (error) => console.log('polling_error,', error.message))
bot.on('error', (error) => console.log('error,', error.message))

export default bot
