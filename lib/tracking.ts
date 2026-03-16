interface DownloadEvent {
  playbookPath: string;
  category: string;
  playbookName: string;
  userAgent?: string;
  referer?: string;
  country?: string;
}

/**
 * Fire-and-forget download tracking. Posts to the Beelink API.
 * No-ops silently if TRACKING_API_URL is not set (local dev).
 * Never throws, never blocks the response.
 */
export function trackDownload(event: DownloadEvent): void {
  const url = process.env.TRACKING_API_URL;
  if (!url) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timeout));
}
