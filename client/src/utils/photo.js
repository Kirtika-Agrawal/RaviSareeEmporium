// Phone camera photos are several MB. A 1024px JPEG uploads in a moment on
// shop Wi-Fi and is still more detail than the photo matcher looks at.
export async function shrinkPhoto(file, maxSide = 1024) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.85));
}
