import { ImageResponse } from "next/og";

export const alt = "Kanbi — a fast, keyboard-first kanban";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadGoogleFont(family: string, weight: number, text: string) {
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const match = css.match(
    /src:\s*url\((.+?)\)\s*format\(['"]?(opentype|truetype|woff2?)['"]?\)/,
  );
  if (!match) throw new Error(`Could not resolve font URL for ${family}`);
  const res = await fetch(match[1]!);
  if (!res.ok) throw new Error(`Failed to fetch font ${family}`);
  return res.arrayBuffer();
}

export default async function Image() {
  const wordmark = "Kanbi";
  const geistBold = await loadGoogleFont("Geist", 800, wordmark);

  const card = (offsetX: number, offsetY: number, opacity: number) => ({
    position: "absolute" as const,
    left: offsetX,
    top: offsetY,
    width: 84,
    height: 84,
    borderRadius: 12,
    background: "#ffffff",
    opacity,
  });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 50% 55%, #1b1d35 0%, #101124 45%, #0b0b0f 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 128,
            height: 116,
            display: "flex",
          }}
        >
          <div style={card(0, 32, 0.35)} />
          <div style={card(22, 16, 0.65)} />
          <div style={card(44, 0, 1)} />
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Geist",
            fontWeight: 800,
            fontSize: 124,
            letterSpacing: -3,
            lineHeight: 1,
            backgroundImage:
              "linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #b5b7c6 100%)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {wordmark}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Geist",
          data: geistBold,
          style: "normal",
          weight: 800,
        },
      ],
    },
  );
}
