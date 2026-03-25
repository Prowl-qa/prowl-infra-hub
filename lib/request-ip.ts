export interface ClientIpRequestLike {
  headers: { get(name: string): string | null };
  method: string;
  nextUrl: {
    host: string;
    hostname: string;
    pathname: string;
  };
  ip?: string | null;
}

export function getClientIpFromRequest(request: ClientIpRequestLike): string | null {
  if (request.ip) {
    return request.ip;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) {
    return forwarded;
  }

  if (request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1') {
    return '127.0.0.1';
  }

  return null;
}
