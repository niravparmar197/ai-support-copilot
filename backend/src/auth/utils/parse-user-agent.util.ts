// Rough, display-only label ("Chrome on Windows") — not a real UA parser.
// Order matters: some UAs claim multiple browsers at once (Edge and Opera
// both include "Chrome/" in their string, Safari's real UA also matches a
// naive "Safari" check on Chrome), so the more specific checks run first.
export function parseUserAgentLabel(
  userAgent: string | null | undefined,
): string {
  if (!userAgent) {
    return 'Unknown device';
  }

  return `${detectBrowser(userAgent)} on ${detectOs(userAgent)}`;
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Unknown browser';
}

function detectOs(ua: string): string {
  if (/Windows/.test(ua)) return 'Windows';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}
