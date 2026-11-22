import { normalizeCategory } from './categories';

export const productPath = (id) => `/product/${encodeURIComponent(id)}`;

export const categoryPath = (name) => (name ? `/?category=${encodeURIComponent(name)}` : '/');

export const currentPath = () => window.location.pathname + window.location.search;

export function parseRoute(path = currentPath()) {
  const url = new URL(path, window.location.origin);
  const match = url.pathname.match(/^\/product\/([^/]+)\/?$/);
  if (match) return { page: 'product', id: decodeURIComponent(match[1]) };
  if (/^\/about\/?$/.test(url.pathname)) return { page: 'about' };
  if (/^\/contact\/?$/.test(url.pathname)) return { page: 'contact' };
  return { page: 'home', category: normalizeCategory(url.searchParams.get('category')) };
}
