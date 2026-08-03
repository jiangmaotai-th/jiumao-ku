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
  summary: string
  /** Tag used by header filters: 软件 / 游戏 / 其他 */
  category: CatalogCategory
  downloads: DownloadLink[]
}

/** All products in one catalog — filter by `category`. */
export const catalog: CatalogItem[] = [
  {
    id: 'store-price',
    name: 'AI 订阅低价区查询器（每日更新）',
    summary: [
      '覆盖全球主流 AI 订阅：App Store / 网页 / 桌面分通道查看低价区服前 10，并跟踪价格历史。',
      '公开标价折合人民币，仅供参考，非各平台官方服务。每日按官方档位表更新。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线使用',
        href: '/store/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'xiaowu-image',
    name: '小午图片格式全能转换',
    summary: [
      '小午的图片转换是一款本机图片格式互转工具：JPEG、PNG、WebP、BMP 浏览器内一键转换；桌面 Pro 另支持 PSD、TIFF、HEIC。',
      '网页版全部在浏览器本地处理，不上传服务器。复杂 PSD 与 HEIC 输出请使用 macOS 桌面版。',
      '本地处理｜网页不上传；桌面版 Photoshop / ImageMagick 高保真转换。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线使用',
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
    name: '魔书(全能电子书格式互转）',
    summary: [
      '魔书是一款电子书格式互转工具，EPUB、PDF、TXT、DOCX、AZW3 等一键转换，批量处理也省心。',
      '点开即用：常规格式本地转换；AZW3/MOBI 经服务器瞬时转换后立即删除。',
      '本地处理｜常规格式本机转换；AZW3/MOBI 瞬时转换不保留文件。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线使用',
        href: '/ebook/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'moyee',
    name: '魔叶Converte（全能视频音频转换）',
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
        label: '在线使用',
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
    id: 'switch-price',
    name: 'Switch 游戏低价查询器',
    summary: [
      '显示游戏低价区服：按人民币查看 Nintendo eShop 数字版各地区标价。',
      '数据来自公开店面展示价，仅供参考，非 Nintendo 官方服务。',
    ].join('\n'),
    category: 'software',
    downloads: [
      {
        platform: 'web',
        label: '在线使用',
        href: '/switch/',
        openInPlace: true,
      },
    ],
  },
  {
    id: 'mowin',
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
]

export function filterCatalog(tab: FilterTab): CatalogItem[] {
  if (tab === 'all') return catalog
  return catalog.filter((item) => item.category === tab)
}
