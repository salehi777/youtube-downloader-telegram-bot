
import ffmpeg from 'ffmpeg-static'
import { spawn } from 'child_process'

export const mergeVideoAudio = (audioPath, videoPath, outputPath) =>
  new Promise((resolve, reject) => {
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

    const ffmpegProcess = spawn(ffmpeg, args)

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`merge error ${code}`))
      }
    })

    ffmpegProcess.on('error', reject)
  })
