import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Epstein Africa";
  const subtitle = searchParams.get("subtitle") || "Email Database";
  const type = searchParams.get("type") || "page";

  const accentColor = type === "person" ? "#c8860a" : "#c0392b";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          background: "#0c0c0c",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              background: accentColor,
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "20px",
              fontWeight: 700,
            }}
          >
            EA
          </div>
          <div style={{ color: "#888", fontSize: "20px" }}>
            epstein-africa.vercel.app
          </div>
        </div>

        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.2,
            marginBottom: "20px",
            maxWidth: "900px",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: "24px",
            color: "#888888",
            lineHeight: 1.5,
            maxWidth: "800px",
          }}
        >
          {subtitle}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "6px",
            background: accentColor,
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
