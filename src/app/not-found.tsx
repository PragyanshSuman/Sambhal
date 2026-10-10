import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Not found</h1>
      <p className="mt-2 text-ink-soft">This page or problem doesn&apos;t exist, or the link is broken.</p>
      <Link href="/map" className="btn-primary mt-6">
        Back to the map
      </Link>
    </div>
  );
}
