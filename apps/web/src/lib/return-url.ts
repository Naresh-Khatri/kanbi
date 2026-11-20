export const RETURN_URL_PARAM = "returnUrl";
export const RETURN_URL_HEADER = "x-return-url";
export const EXPIRED_PARAM = "expired";

const FALLBACK = "/app";

/** same-origin paths only -> no open redirect via //evil.com or /\evil.com */
export function safeReturnUrl(value: string | null | undefined) {
  if (!value?.startsWith("/") || /^\/[/\\]/.test(value)) return FALLBACK;
  return value;
}

/** path + returnUrl (and expired flag); default destination stays implicit */
export function withReturnUrl(
  path: string,
  returnUrl: string | null | undefined,
  opts?: { expired?: boolean },
) {
  const params = new URLSearchParams();
  const safe = safeReturnUrl(returnUrl);
  if (safe !== FALLBACK) params.set(RETURN_URL_PARAM, safe);
  if (opts?.expired) params.set(EXPIRED_PARAM, "1");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function loginUrl(
  returnUrl: string | null | undefined,
  opts?: { expired?: boolean },
) {
  return withReturnUrl("/login", returnUrl, opts);
}

// mirrors better-auth's relative-callback check; anything else -> social sign-in 403s
const AUTH_CALLBACK_RE =
  /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/;

export function socialCallbackUrl(value: string) {
  const safe = safeReturnUrl(value);
  return AUTH_CALLBACK_RE.test(safe) ? safe : FALLBACK;
}
