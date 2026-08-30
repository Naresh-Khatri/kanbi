import "server-only";

import { and, eq } from "drizzle-orm";
import type { JWTPayload } from "jose";

import { db } from "@/server/db";
import { oauthConsent } from "@/server/db/schema";

const KANBI_SCOPE_PREFIX = "kanbi:";

export type McpAuthorization = {
  userId: string;
  clientId: string;
  scopes: string[];
};

function normalizeScopeValue(value: unknown): string[] {
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  if (Array.isArray(value)) {
    return value.filter((scope): scope is string => typeof scope === "string");
  }
  return [];
}

/** Normalize the two OAuth scope-claim formats emitted by supported clients. */
export function scopesFromClaims(jwt: JWTPayload): string[] {
  const claims = jwt as Record<string, unknown>;
  const scopes = normalizeScopeValue(claims.scopes ?? claims.scope);
  return Array.from(new Set(scopes));
}

/**
 * Confirm that a verified JWT still has a live OAuth consent covering every
 * Kanbi permission it claims. Standard OAuth/OIDC scopes do not grant Kanbi
 * capabilities and are intentionally ignored here.
 */
export function authorizeMcpClaims(
  jwt: JWTPayload,
  consentScopes: readonly string[] | null,
): McpAuthorization | null {
  if (
    typeof jwt.sub !== "string" ||
    !jwt.sub ||
    typeof jwt.azp !== "string" ||
    !jwt.azp ||
    !consentScopes
  ) {
    return null;
  }

  const scopes = scopesFromClaims(jwt).filter((scope) =>
    scope.startsWith(KANBI_SCOPE_PREFIX),
  );
  const granted = new Set(consentScopes);
  if (scopes.some((scope) => !granted.has(scope))) return null;

  return { userId: jwt.sub, clientId: jwt.azp, scopes };
}

/**
 * Check the currently stored grant after JWT verification. Removing consent
 * therefore invalidates signed access tokens immediately, before their expiry.
 */
export async function authorizeMcpGrant(
  jwt: JWTPayload,
): Promise<McpAuthorization | null> {
  if (
    typeof jwt.sub !== "string" ||
    !jwt.sub ||
    typeof jwt.azp !== "string" ||
    !jwt.azp
  ) {
    return null;
  }

  const consents = await db
    .select({ scopes: oauthConsent.scopes })
    .from(oauthConsent)
    .where(
      and(eq(oauthConsent.userId, jwt.sub), eq(oauthConsent.clientId, jwt.azp)),
    );
  const effectiveScopes = Array.from(
    new Set(consents.flatMap((consent) => consent.scopes)),
  );

  return authorizeMcpClaims(
    jwt,
    effectiveScopes.length > 0 ? effectiveScopes : null,
  );
}
