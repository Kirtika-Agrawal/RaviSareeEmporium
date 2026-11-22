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

export function removeRecent(id) {
  save(getRecent().filter(r => r.id !== id));
}

export function renameRecent(oldId, newId) {
  save(getRecent().map(r => (r.id === oldId ? { ...r, id: newId } : r)));
}
