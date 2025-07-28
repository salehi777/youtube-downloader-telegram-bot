import fs from 'fs'

export function groupBy(
  arr: any[],
  key: string
): {
  [s: string]: any
} {
  return arr.reduce((result, item) => {
    const groupKey = item[key]
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {})
}

export function toValidFilename(str: string) {
  // Remove or replace invalid characters for both Windows and Linux
  // Windows: <>:"/\|?* and control chars (0-31), Linux: /
  return str
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Windows invalid chars
    .replace(/[\/]/g, '_') // Linux invalid char (redundant for /)
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/^\.+/, '') // Remove leading dots (hidden files)
    .replace(/\.+$/, '') // Remove trailing dots
    .trim()
    .slice(0, 48) // telegram max filename is 64
}

export function chunkArray(arr: any[], size: number) {
  const result: any[] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

export const formatFileSize = (size: string | number) => {
  const bytes = Number(size)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export async function downloadImage(url: string, outputPath: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Error downloading image, status: ${response.status}`)
  }
  const buffer = await response.arrayBuffer()
  fs.writeFileSync(outputPath, Buffer.from(buffer))
}
