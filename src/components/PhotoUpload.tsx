import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { uploadPhoto } from '../lib/photoUpload';

export function PhotoUpload({
  value,
  onChange,
  folder,
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  folder: 'students' | 'teachers';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('uploading');
    setError(null);
    try {
      const url = await uploadPhoto(file, folder);
      onChange(url);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="col-span-2 flex items-center gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-surface">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera size={20} className="text-neutral-500" />
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === 'uploading'}
          className="rounded-lg bg-surface px-3 py-1.5 text-xs text-neutral-200 disabled:opacity-50"
        >
          {status === 'uploading' ? 'Uploading…' : value ? 'Change Photo' : 'Add Photo'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <p className="mt-1 text-[10px] text-neutral-500">Automatically compressed to under 50KB</p>
        {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}
