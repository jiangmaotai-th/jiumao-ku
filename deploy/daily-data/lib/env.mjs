import { readFileSync, existsSync } from 'node:fs'

/** Parse a KEY=value env file. Does not override variables already set in the process. */
export function loadEnvFile(file) {
  if (!file || !existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const body = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed
    const eq = body.indexOf('=')
    if (eq < 1) continue
    const key = body.slice(0, eq).trim()
    let value = body.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function placeholderToken(value) {
  const token = String(value || '').trim()
  if (!token || token === 'replace-me' || token === 'sk-replace-me') return ''
  return token
}

export function envConfig() {
  const key = (process.env.LLM_API_KEY || '').trim()
  const placeholder = !key || key === 'replace-me' || key === 'sk-replace-me'
  return {
    distDir: process.env.DIST_DIR || '/var/www/maotaiworks/dist',
    logDir: process.env.LOG_DIR || '/var/log/maotaiworks',
    llmBaseUrl: (process.env.LLM_BASE_URL || 'https://api.deepseek.com').trim(),
    llmApiKey: placeholder ? '' : key,
    llmModel: (process.env.LLM_MODEL || 'deepseek-chat').trim(),
    githubToken: placeholderToken(process.env.GITHUB_TOKEN),
  }
}
