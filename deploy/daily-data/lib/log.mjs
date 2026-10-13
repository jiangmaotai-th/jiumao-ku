import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function createLogger(logFile) {
  if (logFile) {
    try {
      mkdirSync(dirname(logFile), { recursive: true })
    } catch {
      /* stderr still receives every line */
    }
  }
  const write = (level, args) => {
    const msg = args
      .map((part) => {
        if (part instanceof Error) return part.stack || part.message
        if (typeof part === 'string') return part
        return JSON.stringify(part)
      })
      .join(' ')
    const line = `${new Date().toISOString()} ${level} ${msg}\n`
    process.stderr.write(line)
    if (!logFile) return
    try {
      appendFileSync(logFile, line)
    } catch {
      /* journal / stderr already has the line */
    }
  }
  return {
    info: (...args) => write('INFO', args),
    error: (...args) => write('ERROR', args),
  }
}
