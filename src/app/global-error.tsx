"use client";

// Replaces the root layout when it fails, so it can't rely on globals.css.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <title>Something went wrong · Sambhal</title>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: "#64748b" }}>Sambhal couldn&apos;t load. Please try again in a moment.</p>
        {error.digest && <p style={{ color: "#64748b", fontFamily: "monospace", fontSize: 12 }}>Ref: {error.digest}</p>}
        <button
          onClick={() => retry()}
          style={{ marginTop: 16, padding: "10px 20px", borderRadius: 9999, border: 0, background: "#238472", color: "#fff", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
