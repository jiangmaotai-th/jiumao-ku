import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { BOARDS, buildArenaRelease, publishArena } from '../arena.mjs'
import { ARENA_BOARD_CATEGORIES, ARENA_BOARD_META_BY_KEY, arenaBoardMeta } from '../lib/board-meta.mjs'

const EXPECTED = {
  text: 'arena',
  coding: 'code',
  webdev: 'code',
  math: 'math',
  creative: 'creative',
  vision: 'vision',
}

const UNMAPPED = ['search', 'document', 'i2webdev', 't2i', 't2v', 'i2v', 'vedit']

function mappedBoardList() {
  return BOARDS.filter((board) => Object.hasOwn(ARENA_BOARD_META_BY_KEY, board.key))
}

function row(model, org, rating, rank, votes = 5000) {
  return { model, org, rating, ratingLower: rating - 8, ratingUpper: rating + 8, votes, rank }
}

function tablesFrom(models, boards) {
  const tables = {}
  for (const board of boards) {
    tables[board.key] = {
      updated: '2026-10-08',
      rows: models.map((model, index) => row(
        model.id,
        model.org,
        model.base - index - (board.key === 'text' ? 0 : index),
        index + 1,
        4000 + index * 100,
      )),
    }
  }
  return tables
}

function fixtureModels() {
  return [
    ['claude-opus-5.5-high', 'anthropic'],
    ['claude-opus-4-6-high', 'anthropic'],
    ['gpt-6.1-sol-max', 'openai'],
    ['gpt-5.6-sol-xhigh', 'openai'],
    ['gemini-4-argon-high', 'google'],
    ['gemini-3.8-flash-high', 'google'],
    ['qwen3.8-max', 'alibaba'],
    ['qwen3.7-max-preview', 'alibaba'],
  ].map(([id, org], index) => ({ id, org, base: 1520 - index }))
}

test('board metadata map is the owner mapping and nothing else', () => {
  assert.deepEqual([...ARENA_BOARD_CATEGORIES], [
    'arena', 'code', 'math', 'knowledge', 'index', 'pelican', 'creative', 'vision',
  ])
  assert.deepEqual(Object.keys(ARENA_BOARD_META_BY_KEY), Object.keys(EXPECTED))
  for (const [key, category] of Object.entries(EXPECTED)) {
    assert.deepEqual(arenaBoardMeta(key), { unit: 'elo', higherIsBetter: true, category })
  }
  for (const key of ['search', 'toString', '__proto__', 'constructor', '']) {
    assert.throws(() => arenaBoardMeta(key), /has no category mapping/)
  }
})

test('the full Arena.ai catalog fails loudly and does not guess a category', () => {
  assert.deepEqual(BOARDS.map((board) => board.key), [
    'text', 'coding', 'math', 'creative', 'webdev', 'vision', ...UNMAPPED,
  ])
  assert.throws(
    () => buildArenaRelease({
      tables: {},
      seen: null,
      now: new Date('2026-10-11T00:30:00Z'),
    }),
    new RegExp(`arena boards have no category mapping: ${UNMAPPED.join(', ')}`),
  )
})

test('fixture publish writes unit, higherIsBetter, and category on every board', async () => {
  const boardList = mappedBoardList()
  const release = buildArenaRelease({
    tables: tablesFrom(fixtureModels(), boardList),
    seen: { seededAt: '2026-10-01', models: {} },
    now: new Date('2026-10-11T00:30:00Z'),
    boardList,
  })
  const dir = await mkdtemp(path.join(tmpdir(), 'maotai-board-meta-'))
  await publishArena(dir, release)
  const files = [
    'arena-data/index.json',
    'arena-data/index-2026-10-11.json',
    'arena-data/latest.json',
    'arena-data/2026-10-11.json',
  ]
  for (const rel of files) {
    const body = JSON.parse(await readFile(path.join(dir, rel), 'utf8'))
    assert.equal(body.boards.length, boardList.length)
    for (const board of body.boards) {
      const key = board.k || board.key
      assert.deepEqual(
        { unit: board.unit, higherIsBetter: board.higherIsBetter, category: board.category },
        arenaBoardMeta(key),
      )
    }
  }
})

test('a bad category or unit does not replace yesterday’s arena files', async () => {
  const boardList = mappedBoardList()
  const release = buildArenaRelease({
    tables: tablesFrom(fixtureModels(), boardList),
    seen: null,
    now: new Date('2026-10-11T00:30:00Z'),
    boardList,
  })
  const dir = await mkdtemp(path.join(tmpdir(), 'maotai-board-keep-'))
  const indexPath = path.join(dir, 'arena-data', 'index.json')
  await mkdir(path.dirname(indexPath), { recursive: true })
  const yesterday = '{"keep":true}\n'
  await writeFile(indexPath, yesterday)

  release.index.boards[0] = { ...release.index.boards[0], category: 'knowledge' }
  await assert.rejects(() => publishArena(dir, release), /category must be "arena"/)
  assert.equal(await readFile(indexPath, 'utf8'), yesterday)

  release.index.boards[0] = { ...release.index.boards[0], category: 'arena', unit: 'Elo' }
  await assert.rejects(() => publishArena(dir, release), /unit must be "elo"/)
  assert.equal(await readFile(indexPath, 'utf8'), yesterday)

  release.index.boards[0] = { ...release.index.boards[0], unit: 'elo', higherIsBetter: 'true' }
  await assert.rejects(() => publishArena(dir, release), /higherIsBetter must be true/)
  assert.equal(await readFile(indexPath, 'utf8'), yesterday)
})
