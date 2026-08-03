#!/usr/bin/env node
/**
 * Bump the public AI store “更新时间” stamp.
 * Prefer calling the live API so a running server picks it up immediately:
 *   curl -X POST 'http://127.0.0.1:3192/api/store/content-updated?reason=deploy'
 * This CLI also writes meta.json directly (useful before/without restart).
 */
import { touchContentUpdatedAt, loadMeta, DATA_DIR } from './db.mjs'

const reason = process.argv[2] || 'deploy'
const at = touchContentUpdatedAt(reason)
const meta = loadMeta()
console.log(
  JSON.stringify(
    {
      ok: true,
      dataDir: DATA_DIR,
      contentUpdatedAt: at,
      reason: meta.contentUpdatedReason || reason,
    },
    null,
    2,
  ),
)
