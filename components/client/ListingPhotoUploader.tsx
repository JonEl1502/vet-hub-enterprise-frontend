import React, { useRef, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from '../../services';
import { marketplaceAPI } from '../../services/modules/marketplace.api';
import { uploadsAPI } from '../../services/modules/uploads.api';

const MAX_PHOTOS = 6;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * ⚠️ A listing without photos won't sell — the redesign brief's own words.
 * Up to 6, direct-to-storage presigned upload (same pattern as
 * `ClientSettings.tsx`'s avatar and `ClientPetProfile.tsx`'s memories), drag
 * to reorder. The FIRST url in the array is the cover — that ordering is the
 * whole contract with the rest of the form (preview) and with the detail
 * page, so this component owns reordering rather than leaving it to the
 * caller to get right twice.
 */
const SortablePhoto: React.FC<{ url: string; index: number; onRemove: () => void }> = ({ url, index, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="relative aspect-square rounded-xl overflow-hidden group"
      {...attributes}
      {...listeners}
    >
      <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />
      {index === 0 && (
        <span className="absolute top-1.5 left-1.5 cp-chip text-[9px] !bg-white/90 !text-[var(--cp-ink)]">Cover</span>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove photo"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const ListingPhotoUploader: React.FC<{ value: string[]; onChange: (urls: string[]) => void }> = ({ value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - value.length;
    if (room <= 0) { toast.error(`Up to ${MAX_PHOTOS} photos`); return; }
    const picked = Array.from(files).slice(0, room);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of picked) {
        if (!ACCEPTED.has(file.type)) { toast.error(`${file.name}: use a JPEG, PNG or WebP image`); continue; }
        const signed = await marketplaceAPI.photoUploadUrl({
          contentType: file.type, filename: file.name, sizeBytes: file.size,
        });
        if (!signed.data) { toast.error(signed.message || 'Could not start the upload'); continue; }
        await uploadsAPI.putToSignedUrl(signed.data.uploadUrl, file, file.type);
        uploaded.push(signed.data.publicUrl);
      }
      if (uploaded.length) onChange([...value, ...uploaded]);
    } catch {
      toast.error('A photo failed to upload — try again');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = value.indexOf(String(active.id));
    const to = value.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange(arrayMove(value, from, to));
  };

  return (
    <div>
      <label className="cp-label">
        Photos <span className="cp-muted font-normal normal-case tracking-normal">— first one is the cover, drag to reorder</span>
      </label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {value.map((url, i) => (
              <SortablePhoto key={url} url={url} index={i} onRemove={() => onChange(value.filter((u) => u !== url))} />
            ))}
            {value.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs font-bold cp-muted hover:border-[var(--cp-accent)] hover:text-[var(--cp-accent-dark)] transition-colors"
                style={{ borderColor: 'var(--cp-border)' }}
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                {uploading ? 'Uploading…' : 'Add'}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};

export default ListingPhotoUploader;
