import { ImageResponse } from "next/og";

// App icons, generated so there are no binary assets to maintain.
const SIZES = new Set([180, 192, 512]);

export async function GET(request: Request, { params }: RouteContext<"/icons/[size]">) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  // Maskable icons keep the mark inside the central safe zone.
  const maskable = new URL(request.url).searchParams.has("maskable");
  const mark = Math.round(size * (maskable ? 0.45 : 0.6));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #30a58c, #1f6a5d)",
          borderRadius: maskable ? 0 : size * 0.22,
          color: "white",
          fontSize: mark,
          fontWeight: 800,
        }}
      >
        S
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
