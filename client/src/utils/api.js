//const BASE = '/api';
const BASE = import.meta.env.VITE_API_URL || 'https://ravisareeemporium.onrender.com/api';

export async function fetchProducts(search = '') {
  const url = search ? `${BASE}/products?search=${encodeURIComponent(search)}` : `${BASE}/products`;
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch products');
  return res.json();
}

export async function fetchProduct(productId) {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(productId)}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Product not found');
  return res.json();
}
// Save password in session (clears when browser closes)
export const setAdminPassword = (password) => {
  sessionStorage.setItem('adminPassword', password);
};

export const getAdminPassword = () => {
  return sessionStorage.getItem('adminPassword') || '';
};

export async function checkAdminPassword(password) {
  const res = await fetch(`${BASE}/auth/check`, {
    headers: { 'x-admin-password': password },
  });
  return res.ok;
}

// Add this header to all write requests
const authHeader = () => ({
  'x-admin-password': getAdminPassword()
});

export async function createProduct(formData) {
  const res = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: authHeader(),  // ← add this
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to create product');
  return res.json();
}

export async function addVariant(formData) {
  const res = await fetch(`${BASE}/variants`, {
    method: 'POST',
    headers: authHeader(),  // ← add this
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to add variant');
  return res.json();
}

export async function updateVariant(id, formData) {
  const res = await fetch(`${BASE}/variants/${id}`, {
    method: 'PUT',
    headers: authHeader(),  // ← add this
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to update variant');
  return res.json();
}

export async function deleteVariant(id) {
  const res = await fetch(`${BASE}/variants/${id}`, {
    method: 'DELETE',
    headers: authHeader(),  // ← add this
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete variant');
  return res.json();
}

// changes: { new_product_id?, category? }
export async function updateProduct(productId, changes) {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to update design');
  return res.json();
}

// Empty category removes it.
export async function setCategoryForProducts(productIds, category) {
  const res = await fetch(`${BASE}/products`, {
    method: 'PATCH',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_ids: productIds, category }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to update designs');
  return res.json();
}

// event: 'view' | 'whatsapp' | 'call'. Staff views are counted separately so
// they don't inflate the customer numbers; staff enquiry taps are ignored.
export function trackEvent(productId, event) {
  const staff = Boolean(getAdminPassword());
  if (staff && event !== 'view') return;
  const params = new URLSearchParams({ product_id: productId, event: staff ? 'staff_view' : event });
  fetch(`${BASE}/track?${params}`, { method: 'POST', keepalive: true }).catch(() => {});
}

// Counts a design once per browser session, so flicking back and forth
// doesn't inflate its views.
export function trackView(productId) {
  const key = `rse_viewed:${getAdminPassword() ? 'staff:' : ''}${productId}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  trackEvent(productId, 'view');
}

export async function fetchStats(days) {
  const res = await fetch(`${BASE}/stats?days=${days}`, { headers: authHeader() });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load stats');
  return res.json();
}

export async function fetchIdentifyStatus() {
  const res = await fetch(`${BASE}/identify/status`, { headers: authHeader() });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load status');
  return res.json();
}

// Returns { matches: [{ product_id, variant_number, image_path, category }], indexed, total }
export async function identifyPhoto(photo, hint) {
  const formData = new FormData();
  formData.append('photo', photo, 'photo.jpg');
  if (hint) formData.append('hint', hint);
  const res = await fetch(`${BASE}/identify`, { method: 'POST', headers: authHeader(), body: formData });
  if (!res.ok) throw new Error((await res.json()).error || 'Could not match the photo');
  return res.json();
}

export async function deleteProduct(productId) {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers: authHeader(),  // ← add this
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete product');
  return res.json();
}

export function getProxyUrl(imagePath) {
  const imageUrl = getImageUrl(imagePath);
  return `https://ravisareeemporium.onrender.com/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

export function getImageUrl(imagePath) {
  if (!imagePath) return '';
  // If already a full S3 URL, use it directly
  if (imagePath.startsWith('http')) return imagePath;
  // Fallback for any old local paths
  return `https://ravisareeemporium.onrender.com/uploads/${imagePath}`;
}
