"use client";

import { Camera, EyeOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { compressImage } from "@/lib/image";
import { RULES } from "@/lib/taxonomy";
import { PhotoEditor } from "./PhotoEditor";

/**
 * One photo: camera or gallery, compressed, then the privacy editor opens so faces
 * and plates can be blurred before anything is uploaded.
 * `fresh` rejects photos older than the on-the-spot window (the server also checks).
 */
export function PhotoInput({
  photo,
  onChange,
  label,
  fresh = false,
}: {
  photo: Blob | null;
  onChange: (p: Blob | null) => void;
  label: string;
  fresh?: boolean;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    // The preview URL is derived from the photo prop and revoked with it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (fresh && Date.now() - file.lastModified > RULES.freshPhotoMinutes * 60_000) {
      setError(fmt(t.photo.staleWarning, { n: RULES.freshPhotoMinutes }));
      return;
    }
    try {
      setEditing(await compressImage(file));
    } catch {
      setError(t.photo.process);
    }
  }

  return (
    <div className="mt-3">
      {photo && preview ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
          <img src={preview} alt="" className="max-h-40 rounded-xl" />
          <div className="absolute top-1 right-1 flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(photo)}
              className="grid size-7 place-items-center rounded-full bg-black/60 text-white"
              aria-label={t.photo.edit}
            >
              <EyeOff className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="grid size-7 place-items-center rounded-full bg-black/60 text-white"
              aria-label={t.common.removePhoto}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <label className="btn-secondary w-fit cursor-pointer">
          <Camera className="size-4" /> {label}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      {editing && (
        <PhotoEditor
          photo={editing}
          onCancel={() => setEditing(null)}
          onDone={(edited) => {
            setEditing(null);
            onChange(edited);
          }}
        />
      )}
    </div>
  );
}
