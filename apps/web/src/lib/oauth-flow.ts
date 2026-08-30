const SIGNED_QUERY_FIELDS = ["sig", "exp", "ba_iat", "ba_pl"];

/**
 * Builds a fresh authorize request after login if the OAuth client hook did
 * not redirect on its own. Signed prompt-page fields are only valid while the
 * user is on login/consent and must not be sent back to the authorize endpoint.
 */
export function oauthResumeUrl(search: string) {
  const params = new URLSearchParams(search);
  if (!params.has("sig")) return null;

  for (const field of SIGNED_QUERY_FIELDS) params.delete(field);

  const prompt = params
    .get("prompt")
    ?.split(/\s+/)
    .filter((value) => value !== "login" && value !== "create");
  if (prompt?.length) params.set("prompt", prompt.join(" "));
  else params.delete("prompt");

  return `/api/auth/oauth2/authorize?${params.toString()}`;
}

export function preserveOAuthQuery(path: string, search: string) {
  return search ? `${path}?${search}` : path;
}
