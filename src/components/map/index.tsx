"use client";

import dynamic from "next/dynamic";

function MapSkeleton() {
  return <div className="size-full min-h-64 animate-pulse rounded-xl bg-surface-2" />;
}

export const ProblemsMap = dynamic(() => import("./ProblemsMapInner"), { ssr: false, loading: MapSkeleton });
export const LocationPicker = dynamic(() => import("./LocationPickerInner"), { ssr: false, loading: MapSkeleton });
export type { Bounds } from "./ProblemsMapInner";
