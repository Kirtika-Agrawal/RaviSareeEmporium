// Link previews for WhatsApp and other chat apps. Their link-reading bots
// don't run JavaScript, so vercel.json sends only those bots here, and they
// get a tiny page whose tags carry the design's photo and title. Shoppers
// never hit this; they get the normal app.

const SITE = 'Ravi Saree Emporium';
const API = process.env.PREVIEW_API_URL || 'https://ravisareeemporium-iwcl.onrender.com/api';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

// Chat apps give up on a preview after a few seconds, and the API can be slow
// to wake up, so fall back to the generic preview rather than none at all.
async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Original photos run to several MB, and WhatsApp drops preview images over
// roughly 300 KB, so point at a resized copy from Vercel's image service.
// The width must be listed in "images.sizes" in vercel.json.
const previewImage = (origin, imageUrl) => (imageUrl && imageUrl.startsWith('https://')
  ? `${origin}/_vercel/image?url=${encodeURIComponent(imageUrl)}&w=480&q=75`
  : null);

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

module.exports = async (req, res) => {
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const id = text(req.query.id, 60);
  const category = text(req.query.category, 40);

  let title = `${SITE} · Saree collection`;
  let description = 'Browse our sarees by design number and enquire on WhatsApp for price and availability.';
  let path = '/';
  let imageUrl = null;
  let complete = true;

  if (id) {
    path = `/product/${encodeURIComponent(id)}`;
    const product = await getJson(`${API}/products/${encodeURIComponent(id)}`);
    if (product) {
      const count = product.variants.length;
      title = `Design ${product.product_id} · ${SITE}`;
      description = `${product.category ? `${product.category} saree` : 'Saree'} in ${count} colour${count === 1 ? '' : 's'}. `
        + 'Tap to see every colour and enquire on WhatsApp.';
      imageUrl = product.variants[0]?.image_path;
    } else {
      complete = false;
    }
  } else {
    const params = new URLSearchParams({ limit: '1' });
    if (category) {
      params.set('category', category);
      path = `/?category=${encodeURIComponent(category)}`;
      title = `${category} sarees · ${SITE}`;
      description = `Browse our ${category} sarees and enquire on WhatsApp for price and availability.`;
    }
    const latest = await getJson(`${API}/products?${params}`);
    imageUrl = latest?.[0]?.first_image;
    if (!latest) complete = false;
  }

  const url = `${origin}${path}`;
  const image = previewImage(origin, imageUrl);
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta property="og:site_name" content="${SITE}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    ...(image ? [
      `<meta property="og:image" content="${escapeHtml(image)}">`,
      `<meta property="og:image:alt" content="${escapeHtml(title)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
    ] : ['<meta name="twitter:card" content="summary">']),
  ];

  // Only bots should land here, but if a person's browser ever matches, send
  // them on to the app. app=1 tells vercel.json to skip the bot rule.
  const appUrl = `${path}${path.includes('?') ? '&' : '?'}app=1`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', complete
    ? 'public, s-maxage=3600, stale-while-revalidate=86400'
    : 'public, s-maxage=60');
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${tags.join('\n')}
</head>
<body>
<p><a href="${escapeHtml(appUrl)}">${escapeHtml(title)}</a></p>
<script>location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`);
};
