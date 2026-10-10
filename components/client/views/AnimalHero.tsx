/**
 * The top of an animal's page: a big photo (swipe for more), the name over it,
 * and the few facts you want at a glance. No photo yet → a warm placeholder
 * with the one action that matters, "Add a photo".
 *
 * Photos are shrunk in the browser before upload (a phone photo is 4–8 MB; the
 * page needs ~200 KB) and go straight to storage on a presigned URL, same as
 * pet memories and listing photos.
 */
import React, { useRef, useState } from 'react';
import { Camera, Loader2, Star, Trash2, X, Beef, Tag, ImagePlus } from 'lucide-react';
import { clientPortalAPI, type FarmAnimal } from '../../../services/modules/clientPortal.api';
import { uploadsAPI } from '../../../services/modules/uploads.api';
import { toast } from '../../../services';

const MAX_EDGE = 1600;

/** Resize to at most MAX_EDGE on the long side and re-encode as JPEG. Falls back to the original file if the browser cannot decode it. */
export const shrinkImage = (file: File): Promise<Blob> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { URL.revokeObjectURL(url); resolve(b ?? file); }, 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

interface Props {
  animal: FarmAnimal;
  subtitle: string;
  chips: React.ReactNode;
  /** Re-read the animal after a photo is added, removed or made the cover. */
  onChanged: () => void;
}

const AnimalHero: React.FC<Props> = ({ animal, subtitle, chips, onChanged }) => {
  const input = useRef<HTMLInputElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<{ id: string; url: string } | null>(null);

  // Cover first, then the rest newest-first.
  const photos = [...(animal.photos ?? [])].sort((a, b) => Number(b.url === animal.avatarUrl) - Number(a.url === animal.avatarUrl));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files).slice(0, 6)) {
        if (!/^image\//.test(f.type)) { toast.error(`${f.name} is not a photo`); continue; }
        const blob = await shrinkImage(f);
        const type = blob.type === 'image/jpeg' || blob.type === 'image/png' || blob.type === 'image/webp' ? blob.type : 'image/jpeg';
        const signed = await clientPortalAPI.animalPhotoUploadUrl(animal.id, { contentType: type, filename: f.name, sizeBytes: blob.size });
        if (!signed.success || !signed.data) continue;
        await uploadsAPI.putToSignedUrl(signed.data.uploadUrl, blob, type);
        await clientPortalAPI.addAnimalPhoto(animal.id, { url: signed.data.publicUrl });
      }
      onChanged();
    } catch {
      toast.error('A photo did not upload — check your connection and try again');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const makeCover = async () => {
    if (!open) return;
    const r = await clientPortalAPI.setAnimalPhotoCover(open.id);
    if (r.success) { toast.success('Cover photo set'); setOpen(null); onChanged(); }
  };
  const remove = async () => {
    if (!open) return;
    const r = await clientPortalAPI.deleteAnimalPhoto(open.id);
    if (r.success) { setOpen(null); onChanged(); }
  };

  return (
    <div className="-mx-1">
      <div className="relative rounded-3xl overflow-hidden shadow-lg bg-gradient-to-br from-[#f79b70] to-[#e56a3c]" style={{ aspectRatio: '4 / 3' }}>
        {photos.length > 0 ? (
          <div
            ref={strip}
            className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
            onScroll={(e) => { const el = e.currentTarget; setIndex(Math.round(el.scrollLeft / el.clientWidth)); }}
          >
            {photos.map((p) => (
              <button key={p.id} type="button" className="shrink-0 w-full h-full snap-center" onClick={() => setOpen({ id: p.id, url: p.url })} aria-label="Open photo">
                <img src={p.url} alt={animal.name} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="absolute inset-0 flex flex-col items-center justify-center text-white/95" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={34} className="animate-spin" /> : <Beef size={52} strokeWidth={1.5} />}
            <span className="mt-2 text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <ImagePlus size={14} /> {busy ? 'Uploading…' : 'Add a photo'}
            </span>
          </button>
        )}

        {/* Name and facts, on a scrim so they read on any photo. */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-12 bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none">
          <h2 className="text-2xl font-black text-white leading-tight drop-shadow">{animal.name}</h2>
          <p className="text-xs text-white/85 flex items-center gap-1.5 flex-wrap">
            {subtitle}
            {animal.tagNumber && <span className="inline-flex items-center gap-0.5"><Tag size={10} />{animal.tagNumber}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 pointer-events-auto">{chips}</div>
        </div>

        {photos.length > 1 && (
          <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 pointer-events-none">
            {photos.map((p, i) => <span key={p.id} className={`h-1 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
          </div>
        )}

        {photos.length > 0 && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label="Add photo"
            className="absolute top-2.5 right-2.5 w-10 h-10 rounded-full bg-black/45 backdrop-blur text-white flex items-center justify-center active:scale-90">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col" onClick={() => setOpen(null)} role="dialog" aria-label="Photo">
          <div className="flex justify-end p-3">
            <button className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Close"><X size={20} /></button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-3">
            <img src={open.url} alt={animal.name} className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
          <div className="p-4 flex gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
            {open.url !== animal.avatarUrl && (
              <button className="cp-btn !py-2.5 flex items-center gap-1.5" onClick={makeCover}><Star size={14} /> Make cover</button>
            )}
            <button className="px-4 py-2.5 rounded-2xl bg-white/10 text-white text-sm font-bold flex items-center gap-1.5" onClick={remove}><Trash2 size={14} /> Delete</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimalHero;
