export async function handler(event) {
  try {
    let { url } = JSON.parse(event.body || "{}");
    if (!url) return json({ error: "URL required" }, 400);

    // Normalize URL
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    let pageRes;
    try {
      pageRes = await fetch(url, ua());
    } catch {
      url = url.replace(/^https:\/\//, "http://");
      pageRes = await fetch(url, ua());
    }

    const html = await pageRes.text();

    const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [,""])[1];
    const ex = r => (head.match(r) || [,""])[1].trim();

    const title = ex(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const description =
      ex(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      ex(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const canonical = ex(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    const amphtml = ex(/<link[^>]+rel=["']amphtml["'][^>]*href=["']([^"']+)["']/i);

    // ✅ ROOT DOMAIN ONLY
    const origin = new URL(url).origin;

    const robots = await fetchSpecialFile(origin + "/robots.txt");
    const sitemap = await fetchSpecialFile(origin + "/sitemap.xml");

    return json({
      url,
      title,
      description,
      canonical,
      amphtml,
      robots,
      sitemap
    });

  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

/* ===================== */
/* HELPERS               */
/* ===================== */

async function fetchSpecialFile(fileUrl) {
  try {
    const res = await fetch(fileUrl, ua());
    const type = res.headers.get("content-type") || "";
    const text = await res.text();

    // ❌ Fake robots/sitemap (HTML page)
    if (
      !res.ok ||
      type.includes("text/html") ||
      /<html/i.test(text) ||
      /<title/i.test(text)
    ) {
      return {
        status: 404,
        found: false,
        content: "Not found"
      };
    }

    return {
      status: res.status,
      found: true,
      content: text.slice(0, 2000)
    };

  } catch {
    return {
      status: 404,
      found: false,
      content: "Not found"
    };
  }
}

const ua = () => ({
  redirect: "follow",
  headers: {
    "User-Agent": "MajorMaintenanceProMax/1.0"
  }
});

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}
