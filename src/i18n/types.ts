export const LOCALES = [
  'zh-CN',
  'zh-TW',
  'en',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'hi',
  'th',
  'ru',
  'pt',
] as const

export type Locale = (typeof LOCALES)[number]

export type CatalogCopy = {
  name: string
  summary: string[]
  privacy?: string
}

export type Messages = {
  meta: {
    title: string
    description: string
  }
  common: {
    brand: string
    language: string
    languageLabel: string
    backHome: string
    terms: string
    privacy: string
    credits: string
    openOnline: string
    unavailable: string
    localMark: string
    loading: string
    search: string
    searching: string
    refresh: string
    refreshing: string
    noData: string
    copyright: string
  }
  home: {
    heroLead: string
    filterAll: string
    filterSoftware: string
    filterGame: string
    filterOther: string
    catalogAria: string
    emptyAll: string
    emptySoftware: string
    emptyGame: string
    emptyOther: string
    visitor: string
    visitorToday: string
  }
  catalog: Record<string, CatalogCopy>
  legal: {
    metaTitle: string
    metaDescription: string
    navCopyright: string
    navTerms: string
    navPrivacy: string
    navCredits: string
    title: string
    lead: string
    updated: string
    copyrightTitle: string
    copyrightP1: string
    copyrightP2: string
    copyrightP3: string
    termsTitle: string
    terms: string[]
    privacyTitle: string
    privacyLocalTitle: string
    privacyLocalBody: string
    privacyUploadTitle: string
    privacyUploadItems: string[]
    privacyUploadNote: string
    privacyOtherTitle: string
    privacyOtherItems: string[]
    privacyTip: string
    creditsTitle: string
    creditsIntro: string
  }
  store: {
    metaTitle: string
    metaDescription: string
    navHome: string
    navAll: string
    heroTitle: string
    heroLead: string
    dailyBadge: string
    updatedAtLabel: string
    browseAll: string
    browseTitle: string
    browseLead: string
    searchPlaceholder: string
    searchAria: string
    channelWeb: string
    channelDesktop: string
    channelAppStore: string
    pending: string
    hot: string
    freeTier: string
    none: string
    noMatch: string
    globalWeb: string
    currentLowestRegion: string
    viewProductDeals: string
    updatePrices: string
    updating: string
    priceUpdated: string
    updatingChannel: string
    noPriceChannel: string
    pickRegion: string
    rank: string
    lowest: string
    lowestTag: string
    noPlanPrice: string
    noWebDesktop: string
    unifiedStripe: string
    premium: string
    cheap: string
    baseline: string
    equivalent: string
    noPrice: string
    equivMonth: string
    equiv: string
    globalUnified: string
    globalLowest: string
    selectedRegion: string
    disclaimer: string
    loadingProduct: string
    loadingHome: string
    categoryAll: string
    backToAll: string
    planStructure: string
    changeNote: string
    tableUpdated: string
    status: string
    buyChannel: string
    channelAdvice: string
    allRegionsTop: string
    plan: string
    region: string
    listPrice: string
    relativeUs: string
    bill: string
    topNLowest: string
    priceHistory: string
    noHistory: string
    needTwoDays: string
    samples: string
    appstoreRankHint: string
    billingMonthHint: string
    globalBenchmark: string
    usdParityNote: string
    catChat: string
    catCoding: string
    catImage: string
    catVideo: string
    catAudio: string
    catWriting: string
    catResearch: string
    catDesign: string
    catEdu: string
    catHealth: string
    catHardware: string
    billMonth: string
    billYear: string
    billWeek: string
    billQuarter: string
    billOther: string
    advicePreferAppStore: string
    adviceSimilar: string
    adviceAppStoreOnly: string
    adviceWebOnly: string
    adviceWebPremium: string
  }
  image: {
    metaTitle: string
    metaDescription: string
    heroTitle: string
    heroLead: string
    dropTitle: string
    dropHint: string
    startConvert: string
    downloadAll: string
    clear: string
    settings: string
    format: string
    quality: string
    targetSize: string
    allowResize: string
    suffix: string
    concurrency: string
    statusQueued: string
    statusConverting: string
    statusCompressing: string
    statusSuccess: string
    statusFailed: string
    statusCancelled: string
    retryFailed: string
    cancel: string
    privacyNote: string
  }
  ebook: {
    metaTitle: string
    metaDescription: string
    heroTitle: string
    heroLead: string
    dropTitle: string
    dropHint: string
    fromLabel: string
    toLabel: string
    addFiles: string
    privacyNote: string
    statusIdle: string
    statusRunning: string
    statusDone: string
    statusFailed: string
    download: string
    clearDone: string
  }
  moyee: {
    metaTitle: string
    metaDescription: string
    heroTitle: string
    heroLead: string
    modeConvert: string
    modeCompress: string
    modeMusic: string
    modeMerge: string
    modeExtract: string
    modeManual: string
    modeGif: string
    dropHint: string
    start: string
    engineLoading: string
    engineReady: string
    privacyNote: string
    noJobs: string
  }
  switchApp: {
    metaTitle: string
    metaDescription: string
    navHome: string
    navSearch: string
    heroTitle: string
    heroLead: string
    browseTitle: string
    browseLead: string
    searchPlaceholder: string
    updatePrices: string
    disclaimer: string
    loadingGame: string
    loadingHome: string
  }
}

export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  hi: 'हिन्दी',
  th: 'ไทย',
  ru: 'Русский',
  pt: 'Português',
}
