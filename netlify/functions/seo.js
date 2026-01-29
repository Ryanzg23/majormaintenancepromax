export async function handler(event) {
  try {
    const { url } = JSON.parse(event.body);
    const startUrl = url.startsWith("http") ? url : `https://${url}`;

    /* ---------- REDIRECT TRACKING ---------- */
    const redirectChain = [];
    let currentUrl = startUrl;

    for (let i = 0; i < 10; i++) {
      const res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual"
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) break;

        const nextUrl = new URL(location, currentUrl).href;
        redirectChain.push({ status: res.status, url: nextUrl });
        currentUrl = nextUrl;
      } else {
        break;
      }
    }

    const finalUrl = currentUrl;

    /* ---------- FINAL FETCH ---------- */
    const finalRes = await fetch(finalUrl);
    const finalStatus = finalRes.status;
    const html = await finalRes.text();

    /* ---------- META ---------- */
    const title =
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "";

    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || "";

    const canonical =
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] || "";

    const amphtml =
      html.match(/<link[^>]+rel=["']amphtml["'][^>]+href=["']([^"']+)/i)?.[1] || "";

    /* ---------- ROBOTS & SITEMAP ---------- */
    const root = new URL(finalUrl).origin;

    const robotsRes = await fetch(`${root}/robots.txt`).catch(() => null);
    const robots =
      robotsRes && robotsRes.ok
        ? { found: true, content: await robotsRes.text() }
        : { found: false };

    const sitemapRes = await fetch(`${root}/sitemap.xml`).catch(() => null);
    const sitemap =
      sitemapRes && sitemapRes.ok
        ? { found: true, content: await sitemapRes.text() }
        : { found: false };

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: startUrl,
        finalUrl,
        finalStatus,
        redirectChain,
        title,
        description,
        canonical,
        amphtml,
        robots,
        sitemap
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: true,
        message: err.message || "Unknown error"
      })
    };
  }
}
