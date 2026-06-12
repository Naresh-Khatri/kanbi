import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";

import { env } from "@/env";
import { db } from "@/server/db";
import { MCP_AUDIENCES, MCP_SCOPES } from "@/server/mcp/config";
import { sendPasswordResetEmail } from "@/server/mail";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "pg" or "mysql"
  }),
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  // Each provider is registered only when its client id + secret are both set,
  // so social login is opt-in via env and its absence never blocks startup or
  // email/password auth.
  socialProviders: {
    ...(env.BETTER_AUTH_GITHUB_CLIENT_ID && env.BETTER_AUTH_GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID,
            clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
            redirectURI: env.BETTER_AUTH_URL + "/api/auth/callback/github",
          },
        }
      : {}),
    ...(env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
            clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
            redirectURI: env.BETTER_AUTH_URL + "/api/auth/callback/google",
          },
        }
      : {}),
  },
  plugins: [
    // oauthProvider issues JWT access tokens and looks up the JWT plugin by id
    // ("jwt") - it must be registered explicitly or it throws `jwt_config`.
    // This also exposes the JWKS endpoint the MCP route verifies tokens against.
    jwt(),
    // Turns the app into an OAuth 2.1 provider so MCP clients (Claude Code,
    // opencode) can authenticate via browser consent. Tokens are verified by
    // the MCP route against the JWKS endpoint. See src/server/mcp/config.ts.
    oauthProvider({
      loginPage: "/login",
      consentPage: "/consent",
      // MCP clients (Claude Code, opencode) self-register via RFC 7591 DCR;
      // this advertises the registration_endpoint in the metadata.
      allowDynamicClientRegistration: true,
      // ...and they register anonymously (no session cookie), so registration
      // must not require an existing session. Registering a client grants
      // nothing on its own - the user still has to log in and consent before
      // any token is issued; the /oauth2/register endpoint is rate-limited.
      allowUnauthenticatedClientRegistration: true,
      scopes: [...MCP_SCOPES],
      advertisedMetadata: {
        scopes_supported: [...MCP_SCOPES],
      },
      // Resources we'll mint a JWT for (RFC 8707). Must include whatever host
      // the client is pointed at, or the token comes back opaque.
      validAudiences: MCP_AUDIENCES,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;

/**
 * Which social providers are configured. Server-only: the login/signup pages
 * read this to render a provider's button only when it can actually be used,
 * so an unconfigured provider isn't a dead button.
 */
export const socialProvidersEnabled = {
  github: Boolean(
    env.BETTER_AUTH_GITHUB_CLIENT_ID && env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
  ),
  google: Boolean(
    env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
  ),
};
