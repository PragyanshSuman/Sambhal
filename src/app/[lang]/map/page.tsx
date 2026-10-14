import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { MapExplorer } from "./MapExplorer";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).nav.map };
}

export default function MapPage() {
  return <MapExplorer />;
}
