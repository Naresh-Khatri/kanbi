import { createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { oauthClient } from "@/server/db/schema";

const AUTHORIZE_PATH = "/oauth2/authorize";
const LOG_PREFIX = "[mcp-oauth-authorize]";

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function redirectUrisFrom(value: unknown): string[] | null {
  if (!value || typeof value !== "object") return null;

  const redirectUris = (value as { redirectUris?: unknown }).redirectUris;
  return Array.isArray(redirectUris) &&
    redirectUris.every((uri) => typeof uri === "string")
    ? redirectUris
    : null;
}

function compareRedirectUri(registered: string, requested: string) {
  const comparison = {
    registered,
    rawEqual: registered === requested,
    registeredUtf8Hex: Buffer.from(registered).toString("hex"),
    requestedUtf8Hex: Buffer.from(requested).toString("hex"),
    protocolEqual: false,
    hostnameEqual: false,
    portEqual: false,
    pathnameEqual: false,
    searchEqual: false,
    parseError: null as string | null,
  };

  try {
    const registeredUrl = new URL(registered);
    const requestedUrl = new URL(requested);

    comparison.protocolEqual = registeredUrl.protocol === requestedUrl.protocol;
    comparison.hostnameEqual = registeredUrl.hostname === requestedUrl.hostname;
    comparison.portEqual = registeredUrl.port === requestedUrl.port;
    comparison.pathnameEqual = registeredUrl.pathname === requestedUrl.pathname;
    comparison.searchEqual = registeredUrl.search === requestedUrl.search;
  } catch (error) {
    comparison.parseError =
      error instanceof Error ? error.message : "URL parsing failed";
  }

  return comparison;
}

function deploymentRevision(): string | null {
  return (
    process.env.SOURCE_COMMIT ??
    process.env.GIT_COMMIT_SHA ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    null
  );
}

function redirectResult(value: unknown) {
  let status: number | null = null;
  let location: string | null = null;

  if (value instanceof Response) {
    status = value.status;
    location = value.headers.get("location");
  } else if (value && typeof value === "object") {
    const result = value as {
      status?: unknown;
      url?: unknown;
      headers?: unknown;
    };

    status = typeof result.status === "number" ? result.status : null;
    location = stringValue(result.url);

    if (!location && result.headers instanceof Headers) {
      location = result.headers.get("location");
    }
  }

  if (!location) return { status, locationPath: null, error: null };

  try {
    const url = new URL(location, "https://oauth-diagnostic.invalid");
    return {
      status,
      locationPath: url.pathname,
      error: url.searchParams.get("error"),
    };
  } catch {
    return { status, locationPath: "unparseable", error: null };
  }
}

export const oauthDiagnosticsBefore = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== AUTHORIZE_PATH) return;

  const clientId = stringValue(ctx.query?.client_id);
  const requestedRedirectUri = stringValue(ctx.query?.redirect_uri);
  const [databaseResult, adapterResult] = clientId
    ? await Promise.allSettled([
        db
          .select({ redirectUris: oauthClient.redirectUris })
          .from(oauthClient)
          .where(eq(oauthClient.clientId, clientId))
          .limit(1)
          .then(([client]) => client ?? null),
        ctx.context.adapter.findOne({
          model: "oauthClient",
          where: [{ field: "clientId", value: clientId }],
        }),
      ])
    : ([
        { status: "fulfilled", value: null },
        { status: "fulfilled", value: null },
      ] as const);

  const storedClient =
    databaseResult.status === "fulfilled" ? databaseResult.value : null;
  const adapterClient =
    adapterResult.status === "fulfilled" ? adapterResult.value : null;

  const databaseRedirectUris = storedClient?.redirectUris ?? null;
  const adapterRedirectUris = redirectUrisFrom(adapterClient);
  const providerVersion = ctx.context.options.plugins?.find(
    (plugin) => plugin.id === "oauth-provider",
  )?.version;

  console.info(
    LOG_PREFIX,
    JSON.stringify({
      phase: "before",
      clientId,
      requestedRedirectUri,
      requestedRedirectUriType: typeof ctx.query?.redirect_uri,
      databaseLookupStatus: databaseResult.status,
      adapterLookupStatus: adapterResult.status,
      databaseRedirectUris,
      adapterRedirectUris,
      databaseComparisons:
        requestedRedirectUri && databaseRedirectUris
          ? databaseRedirectUris.map((registered) =>
              compareRedirectUri(registered, requestedRedirectUri),
            )
          : null,
      adapterComparisons:
        requestedRedirectUri && adapterRedirectUris
          ? adapterRedirectUris.map((registered) =>
              compareRedirectUri(registered, requestedRedirectUri),
            )
          : null,
      providerVersion: providerVersion ?? null,
      diagnosticVersion: 1,
      nodeVersion: process.version,
      deploymentRevision: deploymentRevision(),
      forwardedHost: ctx.headers?.get("x-forwarded-host") ?? null,
      forwardedProto: ctx.headers?.get("x-forwarded-proto") ?? null,
      host: ctx.headers?.get("host") ?? null,
    }),
  );
});

export const oauthDiagnosticsAfter = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== AUTHORIZE_PATH) return;

  console.info(
    LOG_PREFIX,
    JSON.stringify({
      phase: "after",
      clientId: stringValue(ctx.query?.client_id),
      ...redirectResult(ctx.context.returned),
    }),
  );
});
