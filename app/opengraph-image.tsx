import { ImageResponse } from "next/og";

export const alt = "Sayso — answer email by talking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BARS = [0.3, 0.55, 0.4, 0.85, 0.6, 1, 0.7, 0.45, 0.9, 0.55, 0.35, 0.7, 0.4];

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#f3f3f1",
          color: "#141414",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 600 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "#141414" }} />
          sayso
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -5, lineHeight: 1 }}>
            Answer email by talking.
          </div>
          <div style={{ fontSize: 34, color: "#3d3d3d" }}>
            Ramble your reply. Every question answered. Nothing sent without your click.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 60 }}>
          {BARS.map((h, i) => (
            <div key={i} style={{ width: 8, height: 60 * h, borderRadius: 4, background: i === 5 ? "#2348f0" : "#141414" }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
