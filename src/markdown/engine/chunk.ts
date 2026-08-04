export interface MarkdownChunk {
  number: number
  sourceName: string
  heading: string
  markdown: string
}

const DEFAULT_MAX = 1200
const DEFAULT_OVERLAP = 120

function headingTitle(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('#')) return null
  const hashes = trimmed.match(/^#+/)?.[0] ?? ''
  if (hashes.length < 1 || hashes.length > 6) return null
  if (!/\s/.test(trimmed[hashes.length] ?? '')) return null
  return trimmed.slice(hashes.length).trim()
}

function isAtomic(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) return true
  const lines = trimmed.split('\n')
  return lines.length >= 2 && lines.filter((l) => l.includes('|')).length >= Math.max(2, lines.length - 1)
}

function parseBlocks(markdown: string): string[] {
  const result: string[] = []
  let buffer: string[] = []
  let inFence = false
  const flush = () => {
    const value = buffer.join('\n').trim()
    if (value) result.push(value)
    buffer = []
  }
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      if (!inFence && buffer.length) flush()
      inFence = !inFence
      buffer.push(line)
      if (!inFence) flush()
    } else if (inFence) {
      buffer.push(line)
    } else if (headingTitle(line) != null) {
      flush()
      result.push(line.trim())
    } else if (!trimmed) {
      flush()
    } else {
      buffer.push(line)
    }
  }
  flush()
  return result
}

function splitOversized(block: string, maximum: number): string[] {
  if (block.length <= maximum || isAtomic(block)) return [block]
  const pieces = block.split(/(?<=[。！？!?；;.!])\s*|\n/).map((s) => s.trim()).filter(Boolean)
  const output: string[] = []
  let buffer = ''
  for (const piece of pieces) {
    if (piece.length > maximum) {
      if (buffer) {
        output.push(buffer)
        buffer = ''
      }
      for (let i = 0; i < piece.length; i += maximum) {
        output.push(piece.slice(i, i + maximum))
      }
    } else if (buffer.length + piece.length + 1 > maximum) {
      output.push(buffer)
      buffer = piece
    } else {
      buffer += (buffer ? '\n' : '') + piece
    }
  }
  if (buffer) output.push(buffer)
  return output
}

function overlapBlocks(blocks: string[], target: number): string[] {
  if (target <= 0) return []
  const result: string[] = []
  let count = 0
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    if (headingTitle(block) != null) continue
    result.unshift(block)
    count += block.length
    if (count >= target) break
  }
  return result
}

function slug(value: string): string {
  const safe = value.replace(/[/\\:*?"<>|]/g, '').slice(0, 30).replace(/\s+/g, '-')
  return safe || 'content'
}

function yaml(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function bodyLength(markdown: string): number {
  return markdown
    .replace(/^#{1,6}\s+.+$/gm, '')
    .replace(/\s+/g, '')
    .length
}

/** Merge tiny divider slides (PART ONE 等) into the following chunk. */
function mergeShortChunks(chunks: MarkdownChunk[], minBody = 140): MarkdownChunk[] {
  if (chunks.length <= 1) return chunks
  const merged: MarkdownChunk[] = []
  let i = 0
  while (i < chunks.length) {
    let cur = chunks[i]
    while (i + 1 < chunks.length && bodyLength(cur.markdown) < minBody) {
      const next = chunks[i + 1]
      const heading =
        cur.heading === next.heading ? cur.heading : `${cur.heading} · ${next.heading}`
      cur = {
        number: 0,
        sourceName: cur.sourceName,
        heading,
        markdown: `${cur.markdown.trim()}\n\n${next.markdown.trim()}`,
      }
      i++
      // Avoid creating oversized blobs when merging several short pages
      if (bodyLength(cur.markdown) >= minBody) break
    }
    merged.push(cur)
    i++
  }
  if (merged.length >= 2 && bodyLength(merged[merged.length - 1].markdown) < minBody) {
    const last = merged.pop()!
    const prev = merged[merged.length - 1]
    merged[merged.length - 1] = {
      ...prev,
      heading:
        prev.heading === last.heading ? prev.heading : `${prev.heading} · ${last.heading}`,
      markdown: `${prev.markdown.trim()}\n\n${last.markdown.trim()}`,
    }
  }
  return merged.map((c, idx) => ({ ...c, number: idx + 1 }))
}

export function chunkMarkdown(
  markdown: string,
  sourceName: string,
  maximumCharacters = DEFAULT_MAX,
  overlapCharacters = DEFAULT_OVERLAP,
): MarkdownChunk[] {
  if (!markdown.trim()) return []
  if (maximumCharacters < 200) throw new Error('切片长度不能小于 200')
  const overlap = Math.min(Math.max(0, overlapCharacters), Math.floor(maximumCharacters / 3))
  const blocks = parseBlocks(markdown)
  const chunks: MarkdownChunk[] = []
  let current: string[] = []
  let currentHeading = '正文'

  const appendChunk = () => {
    if (!current.length) return
    chunks.push({
      number: chunks.length + 1,
      sourceName,
      heading: currentHeading,
      markdown: current.join('\n\n'),
    })
  }

  for (const original of blocks) {
    const heading = headingTitle(original)
    if (heading != null) {
      appendChunk()
      current = []
      currentHeading = heading
    }
    for (const block of splitOversized(original, maximumCharacters)) {
      const candidateLength = current.reduce((n, s) => n + s.length + 2, 0) + block.length
      if (current.length && candidateLength > maximumCharacters) {
        appendChunk()
        current = overlapBlocks(current, overlap)
      }
      current.push(block)
    }
  }
  appendChunk()
  return mergeShortChunks(chunks)
}

export function exportChunksAsFiles(chunks: MarkdownChunk[]): {
  files: Array<{ name: string; content: string }>
  indexJson: string
} {
  const index: Array<Record<string, string | number>> = []
  const files = chunks.map((chunk, offset) => {
    const fileName = `chunk-${String(offset + 1).padStart(3, '0')}-${slug(chunk.heading)}.md`
    const content = `---
source: ${yaml(chunk.sourceName)}
chunk: ${offset + 1}
total: ${chunks.length}
heading: ${yaml(chunk.heading)}
---

${chunk.markdown.trim()}
`
    index.push({
      chunk: offset + 1,
      file: fileName,
      source: chunk.sourceName,
      heading: chunk.heading,
      characters: chunk.markdown.length,
    })
    return { name: fileName, content }
  })
  return { files, indexJson: JSON.stringify(index, null, 2) }
}
