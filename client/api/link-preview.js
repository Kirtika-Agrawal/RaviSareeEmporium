// Link previews for WhatsApp and other chat apps. Their link-reading bots
// don't run JavaScript, so vercel.json sends only those bots here, and they
// get a tiny page whose tags carry a title. Shoppers never hit this; they get
// the normal app. The catalogue is private, so previews never show a photo.

const SITE = 'Ravi Saree Emporium';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

module.exports = (req, res) => {
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const id = text(req.query.id, 60);
  const category = text(req.query.category, 40);

  let title = `${SITE} · Saree collection`;
  let path = '/';
  if (id) {
    title = `Design ${id} · ${SITE}`;
    path = `/product/${encodeURIComponent(id)}`;
  } else if (category) {
    title = `${category} sarees · ${SITE}`;
    path = `/?category=${encodeURIComponent(category)}`;
  }
  const description = 'Our catalogue is private. Tap to log in, or ask the shop for access on WhatsApp.';

  const url = `${origin}${path}`;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    '<meta name="robots" content="noindex">',
    `<meta property="og:site_name" content="${SITE}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    '<meta name="twitter:card" content="summary">',
  ];

  // Only bots should land here, but if a person's browser ever matches, send
  // them on to the app. app=1 tells vercel.json to skip the bot rule.
  const appUrl = `${path}${path.includes('?') ? '&' : '?'}app=1`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
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
