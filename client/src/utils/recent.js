// Designs this browser opened recently, newest first, for the side menu.
const KEY = 'rse_recent';
const MAX = 8;

export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Private browsing or full storage: the list is a nice-to-have.
  }
}

export function addRecent(id, imagePath) {
  save([{ id, image: imagePath }, ...getRecent().filter(r => r.id !== id)].slice(0, MAX));
}

// Photo links expire after a day or two, so swap in fresh ones whenever the
// catalogue loads.
export function refreshRecent(products) {
  const images = new Map(products.map(p => [p.product_id, p.first_image]));
  save(getRecent().map(r => (images.get(r.id) ? { ...r, image: images.get(r.id) } : r)));
}

export function removeRecent(id) {
  save(getRecent().filter(r => r.id !== id));
}

export function renameRecent(oldId, newId) {
  save(getRecent().map(r => (r.id === oldId ? { ...r, id: newId } : r)));
}
