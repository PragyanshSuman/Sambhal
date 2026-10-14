"use client";

import { Loader2, ScanFace, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

type Region = { x: number; y: number; r: number };

// Face detection runs on the device with MediaPipe (free, nothing is uploaded).
const MEDIAPIPE_VERSION = "1.1.0";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

/** Pixelates a circle. Unlike canvas blur filters, this works the same in every browser. */
function pixelate(ctx: CanvasRenderingContext2D, source: CanvasImageSource, { x, y, r }: Region) {
  const block = Math.max(6, Math.round(r / 5));
  const size = Math.max(1, Math.round((2 * r) / block));
  const tiny = document.createElement("canvas");
  tiny.width = size;
  tiny.height = size;
  tiny.getContext("2d")!.drawImage(source, x - r, y - r, 2 * r, 2 * r, 0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, size, size, x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

export function PhotoEditor({
  photo,
  onDone,
  onCancel,
}: {
  photo: Blob;
  onDone: (edited: Blob) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [size, setSize] = useState(6); // % of the shorter side
  const [status, setStatus] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    let alive = true;
    let bmp: ImageBitmap | null = null;
    createImageBitmap(photo).then((b) => {
      bmp = b;
      if (alive) setBitmap(b);
      else b.close();
    });
    return () => {
      alive = false;
      bmp?.close();
    };
  }, [photo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    for (const region of regions) pixelate(ctx, bitmap, region);
  }, [bitmap, regions]);

  function addAt(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!bitmap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * bitmap.width;
    const y = ((e.clientY - rect.top) / rect.height) * bitmap.height;
    const r = (Math.min(bitmap.width, bitmap.height) * size) / 100;
    setRegions((all) => [...all, { x, y, r }]);
  }

  async function findFaces() {
    if (!bitmap) return;
    setDetecting(true);
    setStatus(t.photo.findingFaces);
    try {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.4,
      });
      const { detections } = detector.detect(bitmap);
      detector.close();
      const faces = detections
        .map((d) => d.boundingBox)
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map((b) => ({ x: b.originX + b.width / 2, y: b.originY + b.height / 2, r: Math.max(b.width, b.height) * 0.75 }));
      setRegions((all) => [...all, ...faces]);
      setStatus(faces.length ? fmt(t.photo.facesFound, { n: faces.length }) : t.photo.noFaces);
    } catch (err) {
      console.error("Face detection failed", err);
      setStatus(t.photo.faceDetectFailed);
    } finally {
      setDetecting(false);
    }
  }

  function done() {
    const canvas = canvasRef.current;
    if (!canvas || regions.length === 0) return onDone(photo);
    canvas.toBlob((b) => onDone(b ?? photo), "image/jpeg", 0.85);
  }

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-black/90 text-white" role="dialog" aria-modal aria-label={t.photo.editTitle}>
      <div className="flex items-center justify-between gap-2 p-3">
        <h2 className="font-semibold">{t.photo.editTitle}</h2>
        <button onClick={onCancel} className="grid size-9 place-items-center rounded-full bg-white/10" aria-label={t.common.cancel}>
          <X className="size-5" />
        </button>
      </div>
      <p className="px-3 text-xs text-white/70">{t.photo.editHelp}</p>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        {bitmap ? (
          <canvas
            ref={canvasRef}
            onPointerDown={addAt}
            className="max-h-full max-w-full cursor-crosshair touch-none rounded-lg"
            aria-label={t.photo.blurHint}
          />
        ) : (
          <Loader2 className="size-8 animate-spin" />
        )}
      </div>

      {status && <p className="px-3 pb-2 text-center text-sm text-white/80" aria-live="polite">{status}</p>}

      <div className="space-y-3 border-t border-white/10 p-3">
        <label className="flex items-center gap-3 text-sm">
          <span className="shrink-0">{t.photo.blurSize}</span>
          <input type="range" min={2} max={20} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-white" />
        </label>
        <div className="flex gap-2">
          <button onClick={findFaces} disabled={detecting || !bitmap} className="btn flex-1 bg-white/10 text-white">
            {detecting ? <Loader2 className="size-4 animate-spin" /> : <ScanFace className="size-4" />} {t.photo.autoFaces}
          </button>
          <button
            onClick={() => setRegions((all) => all.slice(0, -1))}
            disabled={regions.length === 0}
            className="btn bg-white/10 text-white"
            aria-label={t.photo.undo}
          >
            <Undo2 className="size-4" />
          </button>
          <button onClick={done} disabled={!bitmap} className="btn-primary flex-1">
            {t.photo.done}
          </button>
        </div>
      </div>
    </div>
  );
}
