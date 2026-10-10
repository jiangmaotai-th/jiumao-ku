export type Platform = 'windows' | 'mac' | 'web'

/** Catalog filter tags shown in the header. */
export type CatalogCategory = 'software' | 'game' | 'other'

export type FilterTab = 'all' | CatalogCategory

export interface DownloadLink {
  platform: Platform
  label: string
  /** Path under site root, e.g. /downloads/mowin/windows.zip or /moyee/ */
  href: string
  filename?: string
  /** Open in same tab (web apps) instead of download */
  openInPlace?: boolean
  /** When false, render as gray disabled control (package not uploaded yet). Default true. */
  available?: boolean
}

export interface CatalogItem {
  id: string
  name: string
  /** Short label for the left homepage rail. */
  navLabel?: string
  summary: string
  /** Tag used by header filters: 软件 / 游戏 / 其他 */
  category: CatalogCategory
  /** Optional poster art; used for game-style catalog cards. */
  cover?: string
  downloads: DownloadLink[]
  /** When false, hidden from the public homepage. Local play still works. Default true. */
  listed?: boolean
}

/** All products in one catalog — filter by `category`. */
export const catalog: CatalogItem[] = [
  {
    id: 'store-price',
    navLabel: 'AI订阅低价区',
    name: 'AI 订阅低价区查询器（每日更新）',
    summary: [
      '覆盖全球主流 AI 订阅：App Store / 网页 / 桌面分通道查看低价区服前 10，并跟踪价格历史。',
      '公开标价折合人民币，仅供参考，非各平台官方服务。每日按官方档位表更新。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/store/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'platform-crop',
    navLabel: '平台视频裁切',
    name: '一键平台视频裁切和格式转换',
    summary: [
      '选平台比例即可在预览上裁切，框可自由微调；自动套用推荐分辨率、格式与码率，也可自行修改。',
      '适合抖音、快手、小红书、视频号、微博、淘宝、YouTube、TikTok、Instagram 等一键出片。全程浏览器本地处理，不上传。',
      '本地处理｜裁切与转换均在本机完成，不上传、不联网。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/platform-crop/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'magic-markdown',
    navLabel: '一键转Markdown',
    name: '一键转Markdown（Obsidian/Notion神器！PDF/Word/图片）',
    summary: [
      '【测试版】全能转 Markdown：PDF、Word（DOC/DOCX）、Apple Pages / Numbers / Keynote、PPTX、Excel（XLSX）、图片 OCR（中英）、ODT/RTF、HTML、EPUB、CSV/TSV、JSON/JSONL/YAML、XML/RSS、Jupyter（IPYNB）、ZIP、TXT/MD、EML 等一键批量转换，并支持智能切片导出。',
      '网页版在浏览器本地完成文档转换与图片 OCR，原文件不上传。音频视频转写、部分旧版 Office（PPT/XLS）请用桌面版（macOS / Windows）。',
      '本地处理｜网页不上传正文；桌面版另含 MarkItDown、Vision OCR 与 Whisper 音视频转写（测试版陆续上架）。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/markdown/',
        openInPlace: true,
      },
      {
        platform: 'mac',
        label: 'macOS',
        href: '/downloads/magic-markdown/mac.dmg',
        filename: '一键转Markdown-mac.dmg',
        available: false,
      },
      {
        platform: 'windows',
        label: 'Windows',
        href: '/downloads/magic-markdown/windows.zip',
        filename: '一键转Markdown-windows.zip',
        available: false,
      },
    ],
  },
  {
    id: 'daily-scratch',
    navLabel: '每日刮刮乐',
    name: '每日刮刮乐',
    summary: [
      '刮开各国彩票，收集幸运图鉴。每天登陆可领取够玩 10 次的金币，点一下就到账。',
      '不注册也能玩，进度留在这台电脑；补注册后换设备也能继续。',
      '进度可保存在本机或游戏账号。',
    ].join('\n'),
    category: 'game',
    cover: '/covers/daily-scratch.jpg',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/scratch/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'idle-tank',
    navLabel: '梦幻水族缸',
    name: '我的梦幻水族缸',
    summary: [
      '世上没有两条一模一样的鱼。花纹和颜色都是这条自己长出来的，养着养着就认出它。',
      '逼真鱼缸布景，换个景就像换了一口缸。人走了鱼还在云端慢慢长大，回来接着喂。',
      '可保存在本机；登录后与刮刮卡共用账号，换电脑也能喂。',
    ].join('\n'),
    category: 'game',
    cover: '/covers/idle-tank.jpg',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/tank/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'ring-goose',
    navLabel: '套大鹅',
    name: '圈来运转·套大鹅',
    summary: [
      '夜市第一人称套圈：细塑料圈是真刚体，鹅会摆头、缩头、遛弯。',
      '六关递进，最后一关三血鹅王会飙中二台词。十到十五圈冲回本。',
      '进度留在这台电脑，可离线玩。',
    ].join('\n'),
    category: 'game',
    // Keep developing locally. Hidden on production until you say to list it.
    listed: !import.meta.env.PROD,
    cover: '/covers/ring-goose.jpg',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/goose/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'xiaowu-image',
    navLabel: '图片/证件照',
    name: '图片全能格式转换/证件照压缩',
    summary: [
      '图片全能格式转换 + 证件照极致压缩：JPEG、PNG、WebP、BMP 浏览器内一键互转；证件照支持 1寸/2寸/自定义尺寸，可压到 10KB 及以下。',
      '网页版全部在浏览器本地处理，不上传服务器。复杂 PSD 与 HEIC 输出请使用 macOS 桌面版。',
      '本地处理｜网页不上传；桌面版 Photoshop / ImageMagick 高保真转换。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/image/',
        openInPlace: true,
      },
      {
        platform: 'mac',
        label: 'macOS',
        href: '/downloads/xiaowu-image/mac.dmg',
        filename: '小午的图片转换Pro-mac.dmg',
      },
    ],
  },
  {
    id: 'ebook',
    navLabel: '电子书互转',
    name: '全能电子书格式互转',
    summary: [
      '魔书是一款电子书格式互转工具，EPUB、PDF、TXT、DOCX、AZW3 等一键转换，批量处理也省心。',
      '点开即用：常规格式本地转换；AZW3/MOBI 经服务器瞬时转换后立即删除。',
      '本地处理｜常规格式本机转换；AZW3/MOBI 瞬时转换不保留文件。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/ebook/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'moyee',
    navLabel: '视频音频转换',
    name: '全能视频音乐压缩、格式转换、合并',
    summary: [
      'MoyeeConverter 是一款全能视频音频转换器，格式转换、体积压缩、参数精调一站式搞定，不用再在四五个工具里来回跳。',
      '它内置抖音、小红书、B站、视频号，以及 TikTok、YouTube、Instagram、Reels 等海内外全平台规格——选好平台一键出片，尺寸、时长、码率不用自己查。',
      '体积压得下、画质保得住、参数调得细，从本地转码到一键出海，一个软件就够了。',
      '本地处理｜转换压缩全在本机完成，不上传、不联网，隐私零泄露。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/moyee/',
        openInPlace: true,
      },
      {
        platform: 'mac',
        label: 'macOS',
        href: '/downloads/moyee/mac.dmg',
        filename: '魔叶Converte-mac.dmg',
        available: false,
      },
      {
        platform: 'windows',
        label: 'Windows',
        href: '/downloads/moyee/windows.zip',
        filename: '魔叶Converte-windows.zip',
        available: false,
      },
    ],
  },
  {
    id: 'video-mute',
    navLabel: '视频一键静音',
    name: '视频一键静音',
    summary: [
      '拖入视频，一键去掉音轨，画面保持原样。适合做无声素材、循环背景或二次配音前处理。',
      '全程浏览器本地处理，不上传。',
      '本地处理｜静音处理在本机完成，不上传、不联网。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/video-mute/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'mowin',
    navLabel: '魔窗',
    name: '魔窗',
    summary: '一扇更好用的桌面窗口工具。',
    category: 'software',
    downloads: [
      {
        platform: 'windows',
        label: 'Windows',
        href: '/downloads/mowin/windows.zip',
        filename: '魔窗-windows.zip',
        available: false,
      },
      {
        platform: 'mac',
        label: 'macOS',
        href: '/downloads/mowin/mac.dmg',
        filename: '魔窗-mac.dmg',
        available: false,
      },
    ],
  },
  {
    id: 'moyi',
    navLabel: '魔译助手',
    name: '魔译（社交平台同步互译交流助手）',
    summary: '轻量、顺手的翻译助手。',
    category: 'software',
    downloads: [
      {
        platform: 'windows',
        label: 'Windows',
        href: '/downloads/moyi/windows.zip',
        filename: '魔译-windows.zip',
        available: false,
      },
      {
        platform: 'mac',
        label: 'macOS',
        href: '/downloads/moyi/mac.dmg',
        filename: '魔译-mac.dmg',
        available: false,
      },
    ],
  },
  {
    id: 'switch-price',
    navLabel: 'Switch低价查询',
    name: 'Switch 低价查询器',
    summary: [
      '显示游戏低价区服：按人民币查看 Nintendo eShop 数字版各地区标价。',
      '数据来自公开店面展示价，仅供参考，非 Nintendo 官方服务。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线免费使用',
        href: '/switch/',
        openInPlace: true,
      },
    ],
  },
]

export function filterCatalog(tab: FilterTab): CatalogItem[] {
  const visible = catalog.filter((item) => item.listed !== false)
  if (tab === 'all') return visible
  return visible.filter((item) => item.category === tab)
}
