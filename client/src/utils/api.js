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

export async function createProduct(formData) {
  const res = await fetch(`${BASE}/products`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to create product');
  return res.json();
}

export async function addVariant(formData) {
  const res = await fetch(`${BASE}/variants`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to add variant');
  return res.json();
}

export async function updateVariant(id, formData) {
  const res = await fetch(`${BASE}/variants/${id}`, {
    method: 'PUT',
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to update variant');
  return res.json();
}

export async function deleteVariant(id) {
  const res = await fetch(`${BASE}/variants/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete variant');
  return res.json();
}

export async function deleteProduct(productId) {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete product');
  return res.json();
}

export function getImageUrl(imagePath) {
  if (!imagePath) return '';
  // If already a full S3 URL, use it directly
  if (imagePath.startsWith('http')) return imagePath;
  // Fallback for any old local paths
  return `https://ravisareeemporium.onrender.com/uploads/${imagePath}`;
}
