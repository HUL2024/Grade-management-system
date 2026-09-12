import { supabase } from './supabase';

const MAX_BYTES = 50 * 1024; // 50KB
const BUCKET = 'photos';

/**
 * Resizes and re-compresses an image in the browser until it's under
 * maxBytes. Tries reducing JPEG quality first, then physical dimensions,
 * so small ID-style photos stay reasonably sharp.
 */
export async function compressImage(file: File, maxBytes = MAX_BYTES): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;

  const maxDimension = 480;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  let quality = 0.82;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Photo processing is not supported on this device/browser.');
    ctx.drawImage(bitmap, 0, 0, width, height);

    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('Could not process this image.');

    if (blob.size <= maxBytes) return blob;

    if (quality > 0.4) {
      quality -= 0.12;
    } else {
      width = Math.round(width * 0.82);
      height = Math.round(height * 0.82);
      quality = 0.7; // give the smaller image a fresh quality budget
    }
  }

  throw new Error('This photo is too detailed to fit under 50KB. Try a simpler or smaller image.');
}

export async function uploadPhoto(file: File, folder: 'students' | 'teachers'): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  const blob = await compressImage(file);
  const path = `${folder}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
