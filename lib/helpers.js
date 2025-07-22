export function groupBy(arr, key) {
  return arr.reduce((result, item) => {
    const groupKey = item[key]
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {})
}

export function toValidFilename(str) {
  // Remove or replace invalid characters for both Windows and Linux
  // Windows: <>:"/\|?* and control chars (0-31), Linux: /
  return str
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Windows invalid chars
    .replace(/[\/]/g, '_') // Linux invalid char (redundant for /)
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/^\.+/, '') // Remove leading dots (hidden files)
    .replace(/\.+$/, '') // Remove trailing dots
    .trim()
}


export function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

