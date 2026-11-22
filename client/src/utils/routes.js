export const productPath = (id) => `/product/${encodeURIComponent(id)}`;

export function parseRoute(pathname = window.location.pathname) {
  const match = pathname.match(/^\/product\/([^/]+)\/?$/);
  if (match) return { page: 'product', id: decodeURIComponent(match[1]) };
  if (/^\/about\/?$/.test(pathname)) return { page: 'about' };
  if (/^\/contact\/?$/.test(pathname)) return { page: 'contact' };
  return { page: 'home' };
}
