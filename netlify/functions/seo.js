export async function handler(event) {
  try {
    let { url } = JSON.parse(event.body || "{}");
    if (!url) return json({ error: "URL required" }, 400);

    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    let res;
    try {
      res = await fetch(url, ua());
    } catch {
      url = url.replace(/^https:\/\//, "http://");
      res = await fetch(url, ua());
    }

    const html = await res.text();

    const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [,""])[1];
    const ex = r => (head.match(r) || [,""])[1].trim();

    const title = ex(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const description =
      ex(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      ex(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const canonical = ex(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    const amphtml = ex(/<link[^>]+rel=["']amphtml["'][^>]*href=["']([^"']+)["']/i);

    const base = url.replace(/\/$/, "");
    const robots = await fetchFile(base + "/robots.txt");
    const sitemap = await fetchFile(base + "/sitemap.xml");

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

async function fetchFile(fileUrl) {
  try {
    const r = await fetch(fileUrl, ua());
    if (!r.ok) return { status: r.status, content: "" };
    const t = await r.text();
    return { status: r.status, content: t.slice(0, 2000) };
  } catch {
    return { status: 0, content: "" };
  }
}

const ua = () => ({
  redirect: "follow",
  headers: { "User-Agent": "SEO-Bulk-Checker/1.0" }
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
