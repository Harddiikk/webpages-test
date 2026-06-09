// Vercel serverless function.
// Fetches any public page server-side, strips frame-blocking headers,
// and re-serves it from THIS origin so it can be embedded in an <iframe>.
// Usage: /api/proxy?url=https://odgleads.com/
module.exports = async (req, res) => {
  try {
    const reqUrl = new URL(req.url, 'https://local');
    const target = reqUrl.searchParams.get('url') || 'https://odgleads.com/';
    const t = new URL(target);

    const upstream = await fetch(t.toString(), {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    let html = await upstream.text();
    const origin = t.origin + '/';

    // 1) Inject <base> so the page's relative assets (CSS/JS/img) resolve
    //    back to the original domain instead of our proxy path.
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${origin}">`);
    } else {
      html = `<base href="${origin}">` + html;
    }

    // 2) Remove any in-page meta tags that try to block framing.
    html = html.replace(
      /<meta[^>]+http-equiv=["']?(x-frame-options|content-security-policy)["']?[^>]*>/gi,
      ''
    );

    // 3) Serve from our origin WITHOUT any frame-blocking headers,
    //    so the browser allows it inside our iframe.
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'public, max-age=300');
    res.status(200).send(html);
  } catch (err) {
    res
      .status(502)
      .send('Proxy error: ' + (err && err.message ? err.message : String(err)));
  }
};
