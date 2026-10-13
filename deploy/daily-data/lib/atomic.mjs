import { mkdir, rename, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'

export function insideDir(root, rel) {
  const base = path.resolve(root)
  const full = path.resolve(base, rel)
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error(`refusing to write outside ${base}: ${rel}`)
  }
  return full
}

/** Write a file by renaming a temp file in the same directory. */
export async function writeAtomic(file, contents) {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${randomBytes(4).toString('hex')}`
  await writeFile(tmp, contents)
  await rename(tmp, file)
}

export async function writeJsonAtomic(root, rel, value, { pretty = false } = {}) {
  const file = insideDir(root, rel)
  const text = (pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)) + '\n'
  await writeAtomic(file, text)
  return file
}
