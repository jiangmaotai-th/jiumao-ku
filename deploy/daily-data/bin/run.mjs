#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runArena } from '../arena.mjs'
import { buildDigest, publishDigest, runDigests } from '../digest.mjs'
import { collectNews, collectSkills } from '../lib/collect.mjs'
import { envConfig, loadEnvFile } from '../lib/env.mjs'
import { createLlm } from '../lib/llm.mjs'
import { createLogger } from '../lib/log.mjs'
import { assertDailyIssue, assertSkillsIssue } from '../lib/schema.mjs'

function opt(args, name) {
  const eq = args.find((arg) => arg.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const index = args.indexOf(`--${name}`)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return undefined
}

async function publishKind({ dir, log, llm, githubToken, kind }) {
  const items = kind === 'skills'
    ? await collectSkills(log, new Date(), githubToken)
    : await collectNews(log)
  const label = kind === 'skills' ? 'ai-skills' : 'ai-daily'
  if (!items.length) {
    log.error(`${label} kept previous issue: no source items`)
    return true
  }
  try {
    const built = await buildDigest({ kind, candidates: items, llm, log })
    await publishDigest(dir, label, built.issue, built.locales, kind === 'skills' ? assertSkillsIssue : assertDailyIssue)
    log.info(`${label} published date=${built.issue.date} items=${built.issue.items.length} updatedAt=${built.issue.updatedAt}`)
    return false
  } catch (error) {
    log.error(`${label} kept previous issue: ${error.message}`)
    return true
  }
}

async function main() {
  const args = process.argv.slice(2)
  const flags = new Set(args.filter((arg) => arg.startsWith('--') && !arg.includes('=')))
  const envFile = opt(args, 'env')
    || process.env.DAILY_ENV
    || (existsSync(path.join(process.cwd(), 'daily.env')) ? path.join(process.cwd(), 'daily.env') : '')
    || (existsSync('/etc/maotaiworks/daily.env') ? '/etc/maotaiworks/daily.env' : '')
  if (envFile) loadEnvFile(envFile)

  const env = envConfig()
  const dryRun = flags.has('--dry-run')
  const explicit = flags.has('--arena') || flags.has('--news') || flags.has('--skills') || flags.has('--all')
  const doArena = flags.has('--all') || flags.has('--arena') || !explicit
  const doNews = flags.has('--all') || flags.has('--news') || !explicit
  const doSkills = flags.has('--all') || flags.has('--skills') || !explicit

  let dir = opt(args, 'out')
  if (!dir && dryRun) dir = await mkdtemp(path.join(os.tmpdir(), 'maotaiworks-daily-'))
  if (!dir) dir = env.distDir
  if (!opt(args, 'out') && !dryRun && !existsSync(dir)) {
    throw new Error(`DIST_DIR does not exist: ${dir}`)
  }
  await mkdir(dir, { recursive: true })

  const log = createLogger(path.join(env.logDir, 'daily.log'))
  log.info(`daily-data start dir=${dir} dryRun=${dryRun} arena=${doArena} news=${doNews} skills=${doSkills} llm=${env.llmApiKey ? env.llmModel : 'source-fallback'}`)

  let failed = false
  if (doArena) {
    try {
      await runArena({ dir, log })
    } catch (error) {
      failed = true
      log.error(`arena kept previous data: ${error.stack || error.message}`)
    }
  }
  if (doNews && doSkills) {
    const result = await runDigests({ dir, log, llm: createLlm(env), githubToken: env.githubToken })
    if (result.failed) failed = true
  } else if (doNews || doSkills) {
    const llm = createLlm(env)
    if (doNews && await publishKind({ dir, log, llm, githubToken: env.githubToken, kind: 'daily' })) failed = true
    if (doSkills && await publishKind({ dir, log, llm, githubToken: env.githubToken, kind: 'skills' })) failed = true
  }

  if (dryRun) process.stdout.write(`${dir}\n`)
  process.exitCode = failed ? 1 : 0
}

main().catch((error) => {
  process.stderr.write(`daily-data fatal: ${error.stack || error.message}\n`)
  process.exitCode = 1
})
