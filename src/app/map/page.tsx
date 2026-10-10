import type { Metadata } from "next";
import { MapExplorer } from "./MapExplorer";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return <MapExplorer />;
}
