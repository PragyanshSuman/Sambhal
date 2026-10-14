import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/me", "/report", "/login", "/api/", "/auth/", "/en/admin", "/hi/admin"] },
  };
}
