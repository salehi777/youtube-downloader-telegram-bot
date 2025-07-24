import ffmpeg from 'ffmpeg-static'
import { ChildProcess, spawn } from 'child_process'

export const mergeVideoAudio = (
  audioPath: string,
  videoPath: string,
  outputPath: string
) =>
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
      '-movflags', // Places the moov atom at the beginning of the file
      '+faststart',
      '-y', // Overwrite output file
      outputPath,
    ]

    const ffmpegProcess: ChildProcess = spawn(ffmpeg as string, args)

    ffmpegProcess.on('close', (code) => {
      if (code === 0) resolve(null)
      else reject(new Error(`merge error ${code}`))
    })

    ffmpegProcess.on('error', reject)
  })

export const reEncodeVideo = (inputPath: string, outputPath: string) =>
  new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i',
      inputPath,
      '-c:v',
      'libx264', // Use H.264 video codec
      '-preset',
      'veryfast', // Use the veryfast preset for faster encoding
      '-c:a',
      'copy', // Copy the audio stream without re-encoding
      '-loglevel',
      'error',
      '-y', // Overwrite output file
      outputPath,
    ]

    const ffmpegProcess: ChildProcess = spawn(ffmpeg as string, ffmpegArgs)

    const cpulimitArgs = ['-l', '100', '-p', String(ffmpegProcess.pid)]
    const cpulimitProcess: ChildProcess = spawn('cpulimit', cpulimitArgs)

    ffmpegProcess.stderr?.on('data', (data) => reject(new Error(data)))

    ffmpegProcess.on('close', (code) => {
      if (code === 0) resolve(null)
      else reject(new Error(`re-encode error ${code}`))
    })

    ffmpegProcess.on('error', reject)
    cpulimitProcess.on('error', reject)
  })
