const ytdl = require('ytdl-core')
const ffmpeg = require('ffmpeg-static')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

async function downloadAndMerge(
  url,
  outputPath = './output',
  videoQuality = 'highestvideo'
) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true })
    }

    // Get video info and available formats
    const info = await ytdl.getInfo(url)
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '') // Clean filename

    console.log(`Downloading: ${title}`)

    // Show available video qualities
    const videoFormats = ytdl.filterFormats(info.formats, 'videoonly')
    console.log('\nAvailable video qualities:')
    videoFormats.forEach((format) => {
      console.log(
        `- ${format.qualityLabel || format.quality} (${format.container}) - ${
          format.bitrate
        } kbps`
      )
    })

    // Define file paths
    const videoPath = path.join(outputPath, `${title}_video.mp4`)
    const audioPath = path.join(outputPath, `${title}_audio.mp4`)
    const finalPath = path.join(outputPath, `${title}_final.mp4`)

    // Download video (no audio) with specified quality
    console.log(`\nDownloading video (${videoQuality})...`)
    await downloadStream(url, videoPath, {
      quality: videoQuality,
      filter: 'videoonly',
    })

    // Always download highest quality audio
    console.log('Downloading audio (highest quality)...')
    await downloadStream(url, audioPath, {
      quality: 'highestaudio',
      filter: 'audioonly',
    })

    // Merge video and audio
    console.log('Merging video and audio...')
    await mergeVideoAudio(videoPath, audioPath, finalPath)

    // Clean up temporary files
    fs.unlinkSync(videoPath)
    fs.unlinkSync(audioPath)

    console.log(`Download completed: ${finalPath}`)
    return finalPath
  } catch (error) {
    console.error('Error:', error.message)
    throw error
  }
}

function downloadStream(url, outputPath, options) {
  return new Promise((resolve, reject) => {
    const stream = ytdl(url, options)
    const writeStream = fs.createWriteStream(outputPath)

    stream.pipe(writeStream)

    stream.on('progress', (chunkLength, downloaded, total) => {
      const percent = ((downloaded / total) * 100).toFixed(2)
      process.stdout.write(`\rProgress: ${percent}%`)
    })

    writeStream.on('finish', () => {
      console.log('\nDownload completed')
      resolve()
    })

    stream.on('error', reject)
    writeStream.on('error', reject)
  })
}

function mergeVideoAudio(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i',
      videoPath,
      '-i',
      audioPath,
      '-c:v',
      'copy', // Copy video codec (no re-encoding)
      '-c:a',
      'aac', // Use AAC for audio
      '-shortest', // Finish when shortest stream ends
      '-y', // Overwrite output file
      outputPath,
    ]

    console.log('FFmpeg command:', ffmpeg, args.join(' '))

    const ffmpegProcess = spawn(ffmpeg, args)

    let stderr = ''

    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString()

      // Parse progress from stderr
      const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})/)
      if (timeMatch) {
        const [, hours, minutes, seconds] = timeMatch
        const currentTime =
          parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
        process.stdout.write(
          `\rMerging... ${Math.floor(currentTime / 60)}:${(currentTime % 60)
            .toString()
            .padStart(2, '0')}`
        )
      }
    })

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\nMerging completed successfully')
        resolve()
      } else {
        console.error('\nFFmpeg failed with code:', code)
        console.error('Error details:', stderr)
        reject(new Error(`FFmpeg failed with code ${code}`))
      }
    })

    ffmpegProcess.on('error', (err) => {
      console.error('FFmpeg process error:', err)
      reject(err)
    })
  })
}

// Function to download with specific quality by itag
async function downloadWithItag(
  url,
  outputPath = './output',
  videoItag = null
) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true })
    }

    // Get video info
    const info = await ytdl.getInfo(url)
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '') // Clean filename

    console.log(`Downloading: ${title}`)

    // Define file paths
    const videoPath = path.join(outputPath, `${title}_video.mp4`)
    const audioPath = path.join(outputPath, `${title}_audio.mp4`)
    const finalPath = path.join(outputPath, `${title}_final.mp4`)

    // Download video with specific itag if provided
    console.log('Downloading video...')
    const videoOptions = videoItag
      ? { format: videoItag, filter: 'videoonly' }
      : { quality: 'highestvideo', filter: 'videoonly' }

    await downloadStream(url, videoPath, videoOptions)

    // Always download highest quality audio
    console.log('Downloading audio (highest quality)...')
    await downloadStream(url, audioPath, {
      quality: 'highestaudio',
      filter: 'audioonly',
    })

    // Merge video and audio
    console.log('Merging video and audio...')
    await mergeVideoAudio(videoPath, audioPath, finalPath)

    // Clean up temporary files
    fs.unlinkSync(videoPath)
    fs.unlinkSync(audioPath)

    console.log(`Download completed: ${finalPath}`)
    return finalPath
  } catch (error) {
    console.error('Error:', error.message)
    throw error
  }
}

// Function to get available video qualities
async function getAvailableQualities(url) {
  try {
    const info = await ytdl.getInfo(url)
    const videoFormats = ytdl.filterFormats(info.formats, 'videoonly')

    return videoFormats.map((format) => ({
      quality: format.qualityLabel || format.quality,
      container: format.container,
      bitrate: format.bitrate,
      fps: format.fps,
      itag: format.itag,
    }))
  } catch (error) {
    console.error('Error getting qualities:', error)
    return []
  }
}

// Example usage with different quality options
const youtubeUrl = 'https://www.youtube.com/watch?v=YOUR_VIDEO_ID'
const outputDirectory = './downloads'

// Method 1: Use quality strings (basic)
console.log('=== Method 1: Basic quality selection ===')
downloadAndMerge(youtubeUrl, outputDirectory, 'highest')
  .then((finalPath) => {
    console.log('Success! Final file:', finalPath)
  })
  .catch((error) => {
    console.error('Failed:', error)
  })

// Method 2: First check available qualities, then download with specific itag
console.log('\n=== Method 2: Precise quality selection ===')
getAvailableQualities(youtubeUrl)
  .then((qualities) => {
    console.log('Available qualities:', qualities)

    // Find and download specific quality (e.g., 720p)
    const preferred = qualities.find((q) => q.quality === '720p')
    if (preferred) {
      console.log(`Downloading with 720p quality (itag: ${preferred.itag})`)
      return downloadWithItag(youtubeUrl, outputDirectory, preferred.itag)
    } else {
      console.log('720p not available, downloading highest quality')
      return downloadWithItag(youtubeUrl, outputDirectory)
    }
  })
  .then((finalPath) => {
    console.log('Success! Final file:', finalPath)
  })
  .catch((error) => {
    console.error('Failed:', error)
  })

// Method 3: Interactive quality selection (requires user input)
async function interactiveDownload() {
  try {
    console.log('\n=== Method 3: Interactive selection ===')
    const qualities = await getAvailableQualities(youtubeUrl)

    console.log('\nAvailable video qualities:')
    qualities.forEach((quality, index) => {
      console.log(
        `${index + 1}. ${quality.quality} (${quality.container}) - ${
          quality.bitrate
        } kbps, ${quality.fps} fps`
      )
    })

    // In a real application, you'd use readline or inquirer for user input
    // For demo purposes, let's select 720p or fallback to highest
    const selectedQuality =
      qualities.find((q) => q.quality === '720p') || qualities[0]

    console.log(`Selected: ${selectedQuality.quality}`)
    const finalPath = await downloadWithItag(
      youtubeUrl,
      outputDirectory,
      selectedQuality.itag
    )
    console.log('Success! Final file:', finalPath)
  } catch (error) {
    console.error('Failed:', error)
  }
}

// Uncomment to run interactive download
// interactiveDownload();

// Export for use as module
module.exports = {
  downloadAndMerge,
  downloadWithItag,
  getAvailableQualities,
}
