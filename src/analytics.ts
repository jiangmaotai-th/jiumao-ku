export type AnalyticsAppId =
  | 'home'
  | 'store-price'
  | 'xiaowu-image'
  | 'ebook'
  | 'moyee'
  | 'mowin'
  | 'moyi'
  | 'switch-price'
  | (string & {})

export type AnalyticsEventType = 'view' | 'download' | 'use'

/** Fire-and-forget usage / funnel event. Never throws. */
export function trackEvent(
  app: AnalyticsAppId,
  type: AnalyticsEventType,
  label?: string,
): void {
  try {
    const body = JSON.stringify({ app, type, label })
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/event', blob)) return
    }
    void fetch('/api/event', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}

export function trackView(app: AnalyticsAppId): void {
  trackEvent(app, 'view')
}

export function trackDownload(app: AnalyticsAppId, label?: string): void {
  trackEvent(app, 'download', label)
}

export function trackUse(app: AnalyticsAppId, label?: string): void {
  trackEvent(app, 'use', label)
}
