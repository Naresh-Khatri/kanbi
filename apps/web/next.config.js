/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { fileURLToPath } from "url";
import path from "path";

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  // Trace from the monorepo root so the standalone bundle includes the
  // hoisted node_modules and workspace packages, not just apps/web.
  outputFileTracingRoot: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../",
  ),
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default config;
