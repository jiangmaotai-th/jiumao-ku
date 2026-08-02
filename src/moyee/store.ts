import { create } from 'zustand'
import {
  defaultCompressProfile,
  defaultMusicProfile,
  defaultVideoProfile,
  type AppMode,
  type JobItem,
  type MediaMeta,
  type OutputProfile,
} from './types'
import { compressCrf } from './domain/commandBuilder'
import { downloadBlob, getFfmpeg, runJob, runMerge } from './engine/ffmpegEngine'
import type { CompressMode } from './types'

function uid(): string {
  return crypto.randomUUID()
}

async function probeBlob(blob: Blob, fileName: string): Promise<MediaMeta> {
  const previewUrl = URL.createObjectURL(blob)
  const type = blob.type || ''
  const isImage =
    type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)
  const isAudio =
    type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(fileName)
  const isVideo =
    type.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi|m4v|gif)$/i.test(fileName)

  const meta: MediaMeta = {
    fileName,
    fileSize: blob.size,
    hasVideo: isVideo && !isAudio,
    hasAudio: !isImage,
    previewUrl,
  }

  await new Promise<void>((resolve) => {
    const done = () => resolve()
    const timer = window.setTimeout(done, 4000)

    if (isImage && !isVideo) {
      const img = new Image()
      img.onload = () => {
        meta.width = img.naturalWidth || undefined
        meta.height = img.naturalHeight || undefined
        meta.hasVideo = false
        meta.hasAudio = false
        window.clearTimeout(timer)
        done()
      }
      img.onerror = () => {
        window.clearTimeout(timer)
        done()
      }
      img.src = previewUrl
      return
    }

    if (isAudio && !isVideo) {
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.src = previewUrl
      audio.onloadedmetadata = () => {
        meta.durationSecs = Number.isFinite(audio.duration) ? audio.duration : undefined
        meta.hasVideo = false
        meta.hasAudio = true
        window.clearTimeout(timer)
        done()
      }
      audio.onerror = () => {
        window.clearTimeout(timer)
        done()
      }
      return
    }

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = previewUrl
    video.onloadedmetadata = () => {
      meta.durationSecs = Number.isFinite(video.duration) ? video.duration : undefined
      meta.width = video.videoWidth || undefined
      meta.height = video.videoHeight || undefined
      meta.hasVideo = (video.videoWidth || 0) > 0
      meta.hasAudio = true
      window.clearTimeout(timer)
      done()
    }
    video.onerror = () => {
      window.clearTimeout(timer)
      done()
    }
  })

  return meta
}

async function probeFile(file: File): Promise<MediaMeta> {
  return probeBlob(file, file.name)
}

function revokeJobUrls(job: JobItem) {
  URL.revokeObjectURL(job.meta.previewUrl)
  if (job.outputMeta?.previewUrl) URL.revokeObjectURL(job.outputMeta.previewUrl)
}

function profileForMode(mode: AppMode, file?: File): OutputProfile {
  if (mode === 'music') return defaultMusicProfile()
  if (mode === 'compress') {
    const ext = file?.name.split('.').pop()?.toLowerCase()
    const container = ext && ['mp4', 'mov', 'webm', 'mkv'].includes(ext) ? ext : 'mp4'
    return defaultCompressProfile(container)
  }
  if (mode === 'extract') {
    return { ...defaultMusicProfile(), extractMode: 'audio', container: 'mp3' }
  }
  return defaultVideoProfile()
}

interface Store {
  mode: AppMode
  jobs: JobItem[]
  selectedId: string | null
  engineReady: boolean
  engineLoading: boolean
  engineError: string | null
  banner: string | null
  compressMode: CompressMode
  compressQuality: number
  setMode: (mode: AppMode) => void
  setBanner: (msg: string | null) => void
  setCompressMode: (m: CompressMode) => void
  setCompressQuality: (q: number) => void
  selectJob: (id: string | null) => void
  ensureEngine: () => Promise<void>
  addFiles: (files: FileList | File[]) => Promise<void>
  removeJob: (id: string) => void
  updateProfile: (id: string, profile: OutputProfile) => void
  runSelected: () => Promise<void>
  runAll: () => Promise<void>
  runMergeJobs: () => Promise<void>
  downloadJob: (id: string) => void
}

export const useMoyeeStore = create<Store>((set, get) => ({
  mode: 'convert',
  jobs: [],
  selectedId: null,
  engineReady: false,
  engineLoading: false,
  engineError: null,
  banner: null,
  compressMode: 'standard',
  compressQuality: 50,

  setMode: (mode) => {
    set({ mode, banner: null })
    const { jobs, selectedId } = get()
    if (!selectedId) return
    const job = jobs.find((j) => j.id === selectedId)
    if (!job) return
    get().updateProfile(selectedId, {
      ...profileForMode(mode, job.file),
      trimStartSecs: job.profile.trimStartSecs,
      trimEndSecs: job.profile.trimEndSecs,
    })
  },

  setBanner: (banner) => set({ banner }),
  setCompressMode: (compressMode) => {
    set({ compressMode })
    const { selectedId, jobs, compressQuality } = get()
    if (!selectedId) return
    const job = jobs.find((j) => j.id === selectedId)
    if (!job) return
    get().updateProfile(selectedId, {
      ...job.profile,
      bitrateMode: 'crf',
      crf: compressCrf(compressMode, compressQuality),
    })
  },
  setCompressQuality: (compressQuality) => {
    set({ compressQuality })
    const { selectedId, jobs, compressMode } = get()
    if (!selectedId) return
    const job = jobs.find((j) => j.id === selectedId)
    if (!job) return
    get().updateProfile(selectedId, {
      ...job.profile,
      bitrateMode: 'crf',
      crf: compressCrf(compressMode, compressQuality),
    })
  },

  selectJob: (selectedId) => set({ selectedId }),

  ensureEngine: async () => {
    if (get().engineReady || get().engineLoading) return
    set({ engineLoading: true, engineError: null })
    try {
      await getFfmpeg()
      set({ engineReady: true, engineLoading: false })
    } catch (e) {
      set({
        engineLoading: false,
        engineError: e instanceof Error ? e.message : '引擎加载失败',
      })
    }
  },

  addFiles: async (files) => {
    const list = Array.from(files)
    if (!list.length) return
    await get().ensureEngine()
    const mode = get().mode
    const created: JobItem[] = []
    for (const file of list) {
      const meta = await probeFile(file)
      created.push({
        id: uid(),
        file,
        meta,
        profile: profileForMode(mode, file),
        status: 'ready',
        progress: 0,
      })
    }
    set((s) => ({
      jobs: [...s.jobs, ...created],
      selectedId: created[0]?.id ?? s.selectedId,
      banner: `已添加 ${created.length} 个文件（本地处理，不上传）`,
    }))
  },

  removeJob: (id) => {
    set((s) => {
      const job = s.jobs.find((j) => j.id === id)
      if (job) revokeJobUrls(job)
      const jobs = s.jobs.filter((j) => j.id !== id)
      return {
        jobs,
        selectedId: s.selectedId === id ? (jobs[0]?.id ?? null) : s.selectedId,
      }
    })
  },

  updateProfile: (id, profile) => {
    set((s) => ({
      jobs: s.jobs.map((j) => {
        if (j.id !== id) return j
        if (j.status === 'completed' && j.outputMeta?.previewUrl) {
          URL.revokeObjectURL(j.outputMeta.previewUrl)
        }
        return {
          ...j,
          profile,
          status: j.status === 'completed' ? 'ready' : j.status,
          outputBlob: j.status === 'completed' ? undefined : j.outputBlob,
          outputName: j.status === 'completed' ? undefined : j.outputName,
          outputMeta: j.status === 'completed' ? undefined : j.outputMeta,
        }
      }),
    }))
  },

  runSelected: async () => {
    const { selectedId, jobs, mode } = get()
    if (!selectedId) return
    if (mode === 'merge') {
      await get().runMergeJobs()
      return
    }
    const job = jobs.find((j) => j.id === selectedId)
    if (!job) return
    await get().ensureEngine()
    if (job.outputMeta?.previewUrl) URL.revokeObjectURL(job.outputMeta.previewUrl)
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === job.id
          ? {
              ...j,
              status: 'running',
              progress: 0,
              error: undefined,
              outputBlob: undefined,
              outputName: undefined,
              outputMeta: undefined,
            }
          : j,
      ),
      banner: '正在转换…浏览器内处理，大文件会较慢',
    }))
    try {
      const { blob, fileName } = await runJob({
        file: job.file,
        profile: job.profile,
        mode,
        onProgress: (ratio) => {
          set((s) => ({
            jobs: s.jobs.map((j) =>
              j.id === job.id ? { ...j, progress: Math.round(ratio * 100) } : j,
            ),
          }))
        },
      })
      const outputMeta = await probeBlob(blob, fileName)
      set((s) => ({
        jobs: s.jobs.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: 'completed',
                progress: 100,
                outputBlob: blob,
                outputName: fileName,
                outputMeta,
              }
            : j,
        ),
        banner: '完成，列表已更新为输出文件信息，可下载结果',
      }))
    } catch (e) {
      set((s) => ({
        jobs: s.jobs.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: 'failed',
                error: e instanceof Error ? e.message : '转换失败',
              }
            : j,
        ),
        banner: e instanceof Error ? e.message : '转换失败',
      }))
    }
  },

  runAll: async () => {
    const { jobs, mode, selectedId } = get()
    if (mode === 'merge') {
      await get().runMergeJobs()
      return
    }
    for (const job of jobs) {
      if (job.status === 'completed') continue
      set({ selectedId: job.id })
      await get().runSelected()
    }
    if (selectedId) set({ selectedId })
  },

  runMergeJobs: async () => {
    const files = get().jobs.map((j) => j.file)
    if (files.length < 2) {
      set({ banner: '合并模式请至少添加 2 个视频' })
      return
    }
    await get().ensureEngine()
    const firstId = get().jobs[0]?.id
    if (firstId) {
      const prev = get().jobs.find((j) => j.id === firstId)
      if (prev?.outputMeta?.previewUrl) URL.revokeObjectURL(prev.outputMeta.previewUrl)
      set((s) => ({
        jobs: s.jobs.map((j) =>
          j.id === firstId
            ? {
                ...j,
                status: 'running',
                progress: 0,
                outputBlob: undefined,
                outputName: undefined,
                outputMeta: undefined,
              }
            : j,
        ),
        banner: '正在合并…',
      }))
    }
    try {
      const { blob, fileName } = await runMerge({
        files,
        onProgress: (ratio) => {
          if (!firstId) return
          set((s) => ({
            jobs: s.jobs.map((j) =>
              j.id === firstId ? { ...j, progress: Math.round(ratio * 100) } : j,
            ),
          }))
        },
      })
      const outputMeta = await probeBlob(blob, fileName)
      if (firstId) {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === firstId
              ? {
                  ...j,
                  status: 'completed',
                  progress: 100,
                  outputBlob: blob,
                  outputName: fileName,
                  outputMeta,
                }
              : j,
          ),
          banner: '合并完成，列表已更新为输出文件信息',
        }))
      }
    } catch (e) {
      set({ banner: e instanceof Error ? e.message : '合并失败' })
    }
  },

  downloadJob: (id) => {
    const job = get().jobs.find((j) => j.id === id)
    if (!job?.outputBlob || !job.outputName) return
    downloadBlob(job.outputBlob, job.outputName)
  },
}))
