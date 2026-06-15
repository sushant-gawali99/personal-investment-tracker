import { ImageResponse } from "next/og";

// Branded app icon (MyFolio "M") generated at build time. Serves as the browser
// tab favicon and is referenced by the web app manifest for install icons.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 300,
          fontWeight: 700,
          letterSpacing: -8,
          background: "#ff385c",
          backgroundImage: "linear-gradient(135deg, #ff385c 0%, #e00b41 100%)",
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
