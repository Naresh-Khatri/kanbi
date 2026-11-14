import "server-only";

import { lookup } from "node:dns";
import type { IncomingMessage } from "node:http";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";

import { isPublicAddress } from "./address";
import { parsePageMeta } from "./parse";

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  /** data: url so viewers never hit the third-party host themselves. */
  icon: string | null;
};

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_ICON_BYTES = 64 * 1024;

class BlockedError extends Error {}

// checked at connect time, so dns rebinding can't swap in a private ip after validation
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    if (
      !addresses.length ||
      !addresses.every((a) => isPublicAddress(a.address))
    )
      return callback(new BlockedError(`blocked ${hostname}`), "", 0);
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
};

function checkUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new BlockedError("protocol");
  // internal services usually sit on odd ports
  if (url.port && url.port !== "80" && url.port !== "443")
    throw new BlockedError("port");
  if (url.username || url.password) throw new BlockedError("credentials");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // literal ips skip lookup entirely
  if (isIP(host) && !isPublicAddress(host)) throw new BlockedError("address");
  return url;
}

function request(url: URL, signal: AbortSignal) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).get(
      url,
      {
        lookup: publicLookup,
        signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; KanbiLinkPreview/1.0)",
          accept: "text/html,application/xhtml+xml,image/*;q=0.8",
          "accept-encoding": "identity",
        },
      },
      resolve,
    );
    req.on("error", reject);
  });
}

async function fetchCapped(
  raw: string,
  accept: (contentType: string) => boolean,
  maxBytes: number,
  signal: AbortSignal,
) {
  let url = checkUrl(raw);
  for (let hop = 0; ; hop++) {
    const res = await request(url, signal);
    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      if (hop >= MAX_REDIRECTS) throw new Error("too many redirects");
      url = checkUrl(new URL(res.headers.location, url).href);
      continue;
    }
    const type = res.headers["content-type"]?.toLowerCase() ?? "";
    if (status !== 200 || !accept(type)) {
      res.destroy();
      return null;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res as AsyncIterable<Buffer>) {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= maxBytes) break;
    }
    res.destroy();
    return {
      url: url.href,
      type,
      body: Buffer.concat(chunks).subarray(0, maxBytes),
    };
  }
}

function decodeHtml(body: Buffer, contentType: string) {
  const charset =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(
      body.subarray(0, 2048).toString("latin1"),
    )?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder().decode(body);
  }
}

async function loadIcon(href: string, signal: AbortSignal) {
  const res = await fetchCapped(
    href,
    (t) => t.startsWith("image/"),
    MAX_ICON_BYTES,
    signal,
  ).catch(() => null);
  // truncated image = broken image
  if (!res || res.body.length >= MAX_ICON_BYTES) return null;
  return `data:${res.type.split(";")[0]};base64,${res.body.toString("base64")}`;
}

async function load(raw: string): Promise<LinkPreview | null> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const page = await fetchCapped(
    raw,
    (t) => t.startsWith("text/html") || t.startsWith("application/xhtml"),
    MAX_HTML_BYTES,
    signal,
  );
  if (!page) return null;
  const meta = parsePageMeta(decodeHtml(page.body, page.type), page.url);
  const icon = await loadIcon(
    meta.icon ?? new URL("/favicon.ico", page.url).href,
    signal,
  );
  return {
    url: page.url,
    title: meta.title,
    description: meta.description,
    siteName: meta.siteName,
    icon,
  };
}

const TTL_MS = 6 * 60 * 60 * 1000;
const FAILED_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<
  string,
  { at: number; ttl: number; value: Promise<LinkPreview | null> }
>();

/** Page metadata for a hover card; null when the page is unreachable, blocked, or not html. */
export function getLinkPreview(url: string): Promise<LinkPreview | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  const entry = {
    at: Date.now(),
    ttl: TTL_MS,
    value: load(url).catch(() => null),
  };
  void entry.value.then((v) => {
    if (!v) entry.ttl = FAILED_TTL_MS;
  });
  cache.delete(url);
  cache.set(url, entry);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return entry.value;
}
