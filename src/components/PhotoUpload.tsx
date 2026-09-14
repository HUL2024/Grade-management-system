import { useState } from 'react';
import { Camera as CameraIcon, Image as ImageIcon } from 'lucide-react';
import { uploadPhoto, takePhotoWithCamera, pickPhotoFromGallery } from '../lib/photoUpload';

export function PhotoUpload({
  value,
  onChange,
  folder,
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  folder: 'students' | 'teachers';
}) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function processFile(file: File) {
    setStatus('uploading');
    setError(null);
    try {
      const url = await uploadPhoto(file, folder);
      onChange(url);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed.');
    }
  }

  async function handleCamera() {
    setError(null);
    try {
      const file = await takePhotoWithCamera();
      await processFile(file);
    } catch (err) {
      // User cancelling the camera throws too — only show a message for real failures.
      const msg = err instanceof Error ? err.message : '';
      if (msg && !msg.toLowerCase().includes('cancel')) {
        setError('Could not open the camera.');
      }
    }
  }

  async function handleGallery() {
    setError(null);
    try {
      const file = await pickPhotoFromGallery();
      await processFile(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg && !msg.toLowerCase().includes('cancel')) {
        setError('Could not open the gallery.');
      }
    }
  }

  return (
    <div className="col-span-2 flex items-center gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-surface">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <CameraIcon size={20} className="text-neutral-500" />
        )}
      </div>
      <div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCamera}
            disabled={status === 'uploading'}
            className="flex items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-xs text-neutral-200 disabled:opacity-50"
          >
            <CameraIcon size={14} /> Camera
          </button>
          <button
            type="button"
            onClick={handleGallery}
            disabled={status === 'uploading'}
            className="flex items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-xs text-neutral-200 disabled:opacity-50"
          >
            <ImageIcon size={14} /> Gallery
          </button>
        </div>
        <p className="mt-1 text-[10px] text-neutral-500">
          {status === 'uploading' ? 'Uploading…' : 'Automatically compressed to under 50KB'}
        </p>
        {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}
