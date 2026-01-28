export async function handler(event) {
  try {
    const { url } = JSON.parse(event.body || "{}");

    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "URL is required" })
      };
    }

    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "SEO-Bulk-Checker/1.0"
      }
    });

    const html = await res.text();

    const extract = (regex) => {
      const m = html.match(regex);
      return m ? m[1].trim() : "";
    };

    const title = extract(/<title[^>]*>(.*?)<\/title>/i);
    const description = extract(
      /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i
    );
    const canonical = extract(
      /<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i
    );
    const amphtml = extract(
      /<link\s+rel=["']amphtml["']\s+href=["'](.*?)["']/i
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        url,
        title,
        description,
        canonical,
        amphtml
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
