import fetch from "node-fetch";
import { URL } from "url";

async function fetchRedirectChain(startUrl, maxHops = 10) {
  const chain = [];
  let currentUrl = startUrl;

  for (let i = 0; i < maxHops; i++) {
    let res;
    try {
      res = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual"
      });
    } catch {
      return { error: true };
    }

    const status = res.status;
    const location = res.headers.get("location");

    if (status >= 300 && status < 400 && location) {
      const nextUrl = new URL(location, currentUrl).href;
      chain.push({ status, url: nextUrl });
      currentUrl = nextUrl;
    } else {
      return {
        finalUrl: currentUrl,
        chain
      };
    }
  }

  return { error: true };
}

export async function handler(event) {
  try {
    const { url } = JSON.parse(event.body);
    const targetUrl = url.startsWith("http") ? url : `https://${url}`;

    // Fetch HTML (final resolved page)
    const pageRes = await fetch(targetUrl);
    const html = await pageRes.text();

    // Meta parsing
    const getMeta = (name) => {
      const match = html.match(
        new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)`, "i")
      );
      return match ? match[1] : "";
    };

    const title =
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "";

    const canonical =
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] || "";

    const amphtml =
      html.match(/<link[^>]+rel=["']amphtml["'][^>]+href=["']([^"']+)/i)?.[1] || "";

    // Robots
    const root = new URL(targetUrl).origin;
    const robotsRes = await fetch(`${root}/robots.txt`).catch(() => null);
    const robots =
      robotsRes && robotsRes.ok
        ? { found: true, content: await robotsRes.text() }
        : { found: false };

    // Sitemap
    const sitemapRes = await fetch(`${root}/sitemap.xml`).catch(() => null);
    const sitemap =
      sitemapRes && sitemapRes.ok
        ? { found: true, content: await sitemapRes.text() }
        : { found: false };

    // Redirect detection
    const redirectData = await fetchRedirectChain(targetUrl);

    let redirectStatus = "Unable to resolve";

    if (!redirectData.error) {
      if (redirectData.chain.length === 0) {
        redirectStatus = redirectData.finalUrl;
      } else {
        const chainText = redirectData.chain
          .map(step => `${step.status} to ${step.url}`)
          .join(" → ");
        redirectStatus = chainText;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: targetUrl,
        title,
        description: getMeta("description"),
        canonical,
        amphtml,
        robots,
        sitemap,
        redirectStatus
      })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: true }) };
  }
}
