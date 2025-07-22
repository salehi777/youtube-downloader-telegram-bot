import { youtubeRegex } from './index.js'

export const getValidYoutubeUrl = async (rl) => {
  return new Promise((resolve) => {
    function ask() {
      rl.question('Enter YouTube URL: ', (input) => {
        if (youtubeRegex.test(input)) {
          resolve(input)
        } else {
          console.log('Not a valid URL')
          ask()
        }
      })
    }
    ask()
  })
}

export async function getSelectedQuality(rl, qualities) {
  console.log('Select quality:')
  qualities.forEach(([quality, itag], i) => console.log(`${i}-${quality}`))

  return new Promise((resolve) => {
    function ask() {
      rl.question('Enter Index: ', (input) => {
        const index = Number(input)
        if (!isNaN(index) && index >= 0 && index < qualities.length) {
          resolve(qualities[index][1])
        } else {
          ask()
        }
      })
    }
    ask()
  })
}
