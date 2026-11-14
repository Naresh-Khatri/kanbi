import { Parser } from "htmlparser2";

export type PageMeta = {
  title: string | null;
  description: string | null;
  siteName: string | null;
  /** Absolute icon url, or null to fall back to /favicon.ico. */
  icon: string | null;
};

const clip = (text: string | undefined, max: number) => {
  const value = text?.replace(/\s+/g, " ").trim();
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

/** Title/description/icon from a page's <head>; og/twitter tags win over plain ones. */
export function parsePageMeta(html: string, pageUrl: string): PageMeta {
  const meta = new Map<string, string>();
  const icons: { rel: string; href: string }[] = [];
  let title = "";
  let inTitle = false;
  let done = false;

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (name === "title") inTitle = true;
        else if (name === "meta") {
          const key = (attrs.property ?? attrs.name)?.toLowerCase();
          if (key && attrs.content && !meta.has(key))
            meta.set(key, attrs.content);
        } else if (name === "link" && attrs.href) {
          const rel = attrs.rel?.toLowerCase().split(/\s+/) ?? [];
          if (rel.includes("icon") || rel.includes("apple-touch-icon"))
            icons.push({ rel: rel.join(" "), href: attrs.href });
        } else if (name === "body") done = true;
      },
      ontext(text) {
        if (inTitle) title += text;
      },
      onclosetag(name) {
        if (name === "title") inTitle = false;
        if (name === "head") done = true;
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  // feed in chunks so a huge body after </head> is never parsed
  for (let i = 0; i < html.length && !done; i += 4096) {
    parser.write(html.slice(i, i + 4096));
  }
  parser.end();

  // plain "icon" first; apple-touch icons are big
  const iconHref = (icons.find((i) => !i.rel.includes("apple")) ?? icons[0])
    ?.href;
  let icon: string | null = null;
  if (iconHref) {
    try {
      icon = new URL(iconHref, pageUrl).href;
    } catch {}
  }

  return {
    title: clip(
      meta.get("og:title") ?? meta.get("twitter:title") ?? title,
      200,
    ),
    description: clip(
      meta.get("og:description") ??
        meta.get("twitter:description") ??
        meta.get("description"),
      300,
    ),
    siteName: clip(meta.get("og:site_name"), 80),
    icon,
  };
}
