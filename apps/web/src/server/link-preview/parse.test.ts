import { describe, expect, it } from "vitest";

import { parsePageMeta } from "./parse";

describe("parsePageMeta", () => {
  it("prefers og tags and resolves the icon", () => {
    const html = `<html><head>
      <title>Plain &amp; title</title>
      <meta name="description" content="plain desc">
      <meta content="OG title" property="og:title">
      <meta property="og:description" content="  og   desc ">
      <meta property="og:site_name" content="Example">
      <link rel="apple-touch-icon" href="/apple.png">
      <link rel="shortcut icon" href="/fav.png">
    </head><body><meta property="og:title" content="late"></body></html>`;
    expect(parsePageMeta(html, "https://example.com/a/b")).toEqual({
      title: "OG title",
      description: "og desc",
      siteName: "Example",
      icon: "https://example.com/fav.png",
    });
  });

  it("falls back to <title> and decodes entities", () => {
    expect(parsePageMeta("<title>A &amp; B</title>", "https://x.dev")).toEqual({
      title: "A & B",
      description: null,
      siteName: null,
      icon: null,
    });
  });
});
