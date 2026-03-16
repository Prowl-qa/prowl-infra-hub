const ALLOWED_PARAMS = ['playbook', 'category', 'from', 'to', 'group', 'sort', 'limit'] as const;

export type StatsFetchResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

interface FetchStatsOptions {
  searchParams?: URLSearchParams;
  timeoutMs?: number;
  revalidate?: number;
}

function buildForwardedSearchParams(searchParams?: URLSearchParams): URLSearchParams {
  const forwarded = new URLSearchParams();
  if (!searchParams) {
    return forwarded;
  }

  for (const param of ALLOWED_PARAMS) {
    const value = searchParams.get(param);
    if (value) {
      forwarded.set(param, value);
    }
  }

  return forwarded;
}

export async function fetchStatsFromService({
  searchParams,
  timeoutMs = 5000,
  revalidate = 300,
}: FetchStatsOptions = {}): Promise<StatsFetchResult> {
  const statsUrl = process.env.STATS_API_URL;
  const statsApiKey = process.env.STATS_API_KEY;

  if (!statsUrl || !statsApiKey) {
    return { ok: false, status: 503, error: 'Stats service not configured' };
  }

  const forwarded = buildForwardedSearchParams(searchParams);
  const qs = forwarded.toString();
  const target = `${statsUrl}${qs ? `?${qs}` : ''}`;

  let response: Response;
  try {
    response = await fetch(target, {
      headers: {
        Authorization: `Bearer ${statsApiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate },
    });
  } catch {
    return { ok: false, status: 502, error: 'Stats service unavailable' };
  }

  if (!response.ok) {
    return { ok: false, status: 502, error: 'Stats service error' };
  }

  try {
    const data = await response.json();
    return { ok: true, data };
  } catch {
    return { ok: false, status: 502, error: 'Stats service returned invalid JSON' };
  }
}
