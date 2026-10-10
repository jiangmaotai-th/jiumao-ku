// 回归：竞技场窗口销毁后，音乐调度必须停止、AudioContext 必须关闭（银酱发现的泄漏）。
import assert from 'node:assert/strict'

let created = 0
let closed = 0
class FakeParam { value = 0; setTargetAtTime() {} setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeNode { gain = new FakeParam(); frequency = new FakeParam(); connect() { return this } disconnect() {} start() {} stop() {} setPeriodicWave() {} buffer: unknown = null }
class FakeCtx {
  state = 'running'
  currentTime = 0
  sampleRate = 44100
  destination = new FakeNode()
  constructor() { created++ }
  createGain() { return new FakeNode() }
  createOscillator() { return new FakeNode() }
  createBufferSource() { return new FakeNode() }
  createBiquadFilter() { return new FakeNode() }
  createPeriodicWave() { return {} }
  createBuffer() { return { getChannelData: () => new Float32Array(1) } }
  resume() { return Promise.resolve() }
  suspend() { return Promise.resolve() }
  close() { closed++; this.state = 'closed'; return Promise.resolve() }
}
;(globalThis as any).window = { AudioContext: FakeCtx }

const timers = new Set<unknown>()
const realSet = globalThis.setInterval, realClear = globalThis.clearInterval
;(globalThis as any).setInterval = (fn: () => void, ms: number) => { const t = realSet(fn, ms); timers.add(t); return t }
;(globalThis as any).clearInterval = (t: any) => { timers.delete(t); realClear(t) }

const audio = await import('../../src/arena/audio.ts')

audio.setSound(true)
audio.music.start()
assert.equal(created, 1, '开声音后创建了一个 AudioContext')
assert.equal(timers.size, 1, '音乐调度在跑')

audio.shutdownAudio()
assert.equal(closed, 1, '销毁后 AudioContext 已关闭')
assert.equal(timers.size, 0, '销毁后音乐调度已停止')
assert.equal(audio.soundOn(), false)

audio.music.start()
assert.equal(timers.size, 0, '销毁后再触发音乐也不会重新调度')

audio.setSound(true)
assert.equal(created, 2, '重新挂载后新建一个 AudioContext，不复用已关闭的')
audio.shutdownAudio()
assert.equal(closed, 2)
assert.equal(timers.size, 0)
console.log('audio-destroy: ok')
