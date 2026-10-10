/** Count unique homepage visitors. The total is only shown in /admin/. */
export function pingSiteVisit(): void {
  void fetch('/api/visit', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  }).catch(() => {})
}
