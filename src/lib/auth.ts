export const COOKIE_NAME = 'invite_code';

export function getInviteCode(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)invite_code=([^;]+)/);
  return match?.[1]?.trim() || null;
}

export function requireInviteCode(request: Request): string | null {
  return getInviteCode(request);
}
