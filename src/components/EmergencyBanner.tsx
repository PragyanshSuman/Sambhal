import { Phone, TriangleAlert } from "lucide-react";
import { EMERGENCY_NUMBERS } from "@/lib/taxonomy";

export function EmergencyBanner({ notes = [] }: { notes?: string[] }) {
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger-soft p-4 text-danger" role="alert">
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="size-5" /> This looks dangerous. People first.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>Keep people and animals away. Do not touch or try to fix it yourself.</li>
        <li>Call emergency services now, then post here so peers can warn others.</li>
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {EMERGENCY_NUMBERS.map((e) => (
          <a key={e.number} href={`tel:${e.number}`} className="btn-danger">
            <Phone className="size-4" /> {e.label} {e.number}
          </a>
        ))}
      </div>
    </div>
  );
}
