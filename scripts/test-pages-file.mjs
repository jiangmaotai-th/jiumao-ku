import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href

const filePath = process.argv[2] || '/Users/maotaiyima/Desktop/大阪15日.pages'
const { convertFile } = await import('../src/markdown/engine/convert.ts')
const buf = fs.readFileSync(filePath)
const file = new File([buf], path.basename(filePath))
const r = await convertFile(file)
console.log('file', filePath)
console.log('ok', Boolean(r.markdown), 'len', r.markdown?.length ?? 0)
console.log('warn', r.warning)
console.log('--- head ---')
console.log((r.markdown || '').slice(0, 600))
if (!r.markdown) process.exitCode = 1
