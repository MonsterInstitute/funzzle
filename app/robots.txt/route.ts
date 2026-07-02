import { SITE_URL } from "@/lib/site";

export function GET() {
  const body = `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
