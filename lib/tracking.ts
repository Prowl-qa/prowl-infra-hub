interface DownloadEvent {
  playbookPath: string;
  category: string;
  playbookName: string;
  userAgent?: string;
  referer?: string;
  country?: string;
}

/**
 * Best-effort download tracking. Posts to the Beelink API.
 *
 * No-ops silently if TRACKING_API_URL is not set (local dev).
 * Never throws — failures are swallowed. The 3-second abort timeout
 * caps how long a slow Beelink can hold up the caller.
 *
 * Returns the underlying fetch promise so callers (route handlers)
 * can hand it to Next.js's `after()` to keep the function context
 * alive past the response — otherwise Vercel can tear down the
 * serverless invocation mid-flight and the POST is silently dropped.
 */
export async function trackDownload(event: DownloadEvent): Promise<void> {
  const url = process.env.TRACKING_API_URL;
  if (!url) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
  } catch {
    // Silently swallow — tracking is best-effort, never throws.
  } finally {
    clearTimeout(timeout);
  }
}
