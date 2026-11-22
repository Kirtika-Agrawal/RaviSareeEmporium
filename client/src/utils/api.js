// Also hard-coded in client/vercel.json and client/api/link-preview.js.
const API_ORIGIN = 'https://ravisareeemporium-iwcl.onrender.com';
const BASE = import.meta.env.VITE_API_URL || `${API_ORIGIN}/api`;

async function readJson(res, fallbackError) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fallbackError);
  return data;
}

// ── CUSTOMER ACCESS ──
// Approved customers keep a token in this browser; staff use their password.
const TOKEN_KEY = 'rse_access';

export const getAccessToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setAccessToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing: they'll be asked again next visit.
  }
};

let onLocked = () => {};
// Called when the server turns this browser away, e.g. after staff block it.
export const setOnLocked = (fn) => { onLocked = fn; };

export const viewerHeaders = () => {
  const headers = {};
  const password = getAdminPassword();
  const token = getAccessToken();
  if (password) headers['x-admin-password'] = password;
  if (token) headers['x-access-token'] = token;
  return headers;
};

async function fetchForViewer(url, fallbackError) {
  const res = await fetch(url, { headers: viewerHeaders() });
  if (res.status === 401) {
    onLocked();
    throw new Error('Please log in to see the catalogue');
  }
  return readJson(res, fallbackError);
}

// Returns { token, customer: { id, name, phone, status } }
export async function requestAccess(name, phone) {
  const res = await fetch(`${BASE}/access/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone }),
  });
  return readJson(res, 'Could not send your request');
}

// null when this browser has no token or it has expired
export async function fetchMyAccess() {
  const res = await fetch(`${BASE}/access/me`, { headers: { 'x-access-token': getAccessToken() } });
  if (res.status === 401) return null;
  return readJson(res, 'Could not check your access');
}

export async function logoutAccess() {
  const token = getAccessToken();
  setAccessToken('');
  if (!token) return;
  await fetch(`${BASE}/access/logout`, { method: 'POST', headers: { 'x-access-token': token } }).catch(() => {});
}

export async function fetchCustomers() {
  const res = await fetch(`${BASE}/customers`, { headers: authHeader() });
  return readJson(res, 'Failed to load customers');
}

export async function addCustomer(name, phone) {
  const res = await fetch(`${BASE}/customers`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone }),
  });
  return readJson(res, 'Could not add the customer');
}

// action: 'approve' | 'reject' | 'block' | 'unblock'
export async function updateCustomer(id, action) {
  const res = await fetch(`${BASE}/customers/${id}/${action}`, { method: 'POST', headers: authHeader() });
  return readJson(res, 'Could not update the customer');
}

// ── CATALOGUE ──
export async function fetchProducts(search = '') {
  const url = search ? `${BASE}/products?search=${encodeURIComponent(search)}` : `${BASE}/products`;
  return fetchForViewer(url, 'Failed to fetch products');
}

export async function fetchProduct(productId) {
  return fetchForViewer(`${BASE}/products/${encodeURIComponent(productId)}`, 'Product not found');
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

// suggested: the design numbers that were shown, best first
export async function sendIdentifyFeedback(photo, productId, suggested, hint) {
  const formData = new FormData();
  formData.append('photo', photo, 'photo.jpg');
  formData.append('product_id', productId);
  formData.append('suggested', JSON.stringify(suggested));
  if (hint) formData.append('hint', hint);
  const res = await fetch(`${BASE}/identify/feedback`, { method: 'POST', headers: authHeader(), body: formData });
  if (!res.ok) throw new Error((await res.json()).error || 'Could not save');
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
  return `${API_ORIGIN}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

// Photo links carry a signature in the query string, so take the name from the path.
export function fileNameOf(imageUrl) {
  try {
    return new URL(imageUrl, window.location.origin).pathname.split('/').pop();
  } catch {
    return 'photo.jpg';
  }
}

export function getImageUrl(imagePath) {
  if (!imagePath) return '';
  // If already a full S3 URL, use it directly
  if (imagePath.startsWith('http')) return imagePath;
  // Fallback for any old local paths
  return `${API_ORIGIN}/uploads/${imagePath}`;
}
