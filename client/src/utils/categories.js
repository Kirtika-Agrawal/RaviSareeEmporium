export const SUGGESTED_CATEGORIES = [
  'Banarasi', 'Kanjivaram', 'Silk', 'Cotton', 'Georgette', 'Chiffon',
  'Organza', 'Linen', 'Chanderi', 'Tussar', 'Designer', 'Bridal',
];

// Mirrors the server, so a typed category matches the stored one.
export function normalizeCategory(value) {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!cleaned) return null;
  return cleaned.toLowerCase().replace(/(^|[\s-])\S/g, ch => ch.toUpperCase());
}

// Most designs first, then alphabetical.
export function countCategories(products) {
  const counts = new Map();
  for (const p of products) {
    if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

// Counts from the last full catalogue load, shared with the side menu and
// the staff category picker. null means "not loaded yet".
let knownCounts = null;

export function rememberCategoryCounts(products) {
  knownCounts = countCategories(products);
}

export function knownCategoryCounts() {
  return knownCounts;
}

export function forgetCategoryCounts() {
  knownCounts = null;
}
