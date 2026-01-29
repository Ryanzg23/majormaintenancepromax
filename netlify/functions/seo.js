export async function handler(event) {
  try {
    const { url } = JSON.parse(event.body);
    const startUrl = url.startsWith("http") ? url : `https://${url}`;

    /* ---------------- REDIRECT TRACKING ---------------- */

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

    /* ---------------- FETCH FINAL HTML ---------------- */

    const finalRes = await fetch(finalUrl);
    const html = await finalRes.text();

    /* ---------------- META ---------------- */

    const title =
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "";

    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || "";

    const canonical =
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] || "";

    const amphtml =
      html.match(/<link[^>]+rel=["']amphtml["'][^>]+href=["']([^"']+)/i)?.[1] || "";

    /* ---------------- ROBOTS & SITEMAP ---------------- */

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

    /* ---------------- DNS IP LOOKUP ---------------- */

    const hostname = new URL(finalUrl).hostname;
    const dnsRes = await fetch(
      `https://dns.google/resolve?name=${hostname}&type=A`
    );
    const dnsJson = await dnsRes.json();

    const ips =
      dnsJson.Answer?.map(a => a.data).filter(Boolean) || [];

    /* ---------------- LOAD CPANEL IP LIST ---------------- */

    // 🔴 REPLACE THIS WITH YOUR PUBLISHED CSV URL
    const CPANEL_CSV_URL =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2U3uOILXKnV9VTDJgH2LzuP9uG2SGRf_w65CSL9VXcwIyFrWNNpmycqSQwgl5SwuP6N2HQI8ibXWv/pub?output=csv";

    let cpanelMap = {};

    try {
      const csvRes = await fetch(CPANEL_CSV_URL);
      const csvText = await csvRes.text();

      csvText.split("\n").slice(1).forEach(row => {
        const [name, ip] = row.split(",");
        if (name && ip) {
          cpanelMap[ip.trim()] = name.trim();
        }
      });
    } catch {
      // fail silently
    }

    /* ---------------- MATCH CPANEL ---------------- */

    let cpanelName = "";

    for (const ip of ips) {
      if (cpanelMap[ip]) {
        cpanelName = cpanelMap[ip];
        break;
      }
    }

    if (!cpanelName) {
      cpanelName = ips.length ? "Unknown / CDN / Not in list" : "No IP detected";
    }

    /* ---------------- RESPONSE ---------------- */

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: startUrl,
        finalUrl,
        redirectChain,
        title,
        description,
        canonical,
        amphtml,
        robots,
        sitemap,
        ips,
        cpanelName
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
