export async function handler(event) {
  try {
    let { url } = JSON.parse(event.body || "{}");

    if (!url) {
      return json({ error: "URL is required" }, 400);
    }

    // ✅ Normalize URL (VERY IMPORTANT)
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    let res;
    try {
      res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "SEO-Bulk-Checker/1.0"
        }
      });
    } catch {
      // 🔁 Fallback to http if https fails
      url = url.replace(/^https:\/\//i, "http://");
      res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "SEO-Bulk-Checker/1.0"
        }
      });
    }

    const html = await res.text();

    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const head = headMatch ? headMatch[1] : "";

    const extract = (regex) => {
      const m = head.match(regex);
      return m ? m[1].trim() : "";
    };

    const title =
      extract(/<title[^>]*>([\s\S]*?)<\/title>/i);

    const description =
      extract(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      extract(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);

    const canonical =
      extract(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);

    const amphtml =
      extract(/<link[^>]+rel=["']amphtml["'][^>]*href=["']([^"']+)["']/i);

    return json({
      url,
      title: title || "",
      description: description || "",
      canonical: canonical || "",
      amphtml: amphtml || ""
    });

  } catch (err) {
    return json({
      url: "",
      title: "",
      description: "",
      canonical: "",
      amphtml: "",
      error: err.message
    }, 500);
  }
}

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
