import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Camera, CheckCircle2, Hand, ShieldCheck, Users, Wrench, Sparkles, MapPin, Activity } from "lucide-react";
import { ProblemCard } from "@/components/ProblemCard";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";
import { PATHS, PATH_KEYS, RULES } from "@/lib/taxonomy";
import { PROBLEM_CARD_COLUMNS, type ProblemCard as Card } from "@/lib/types";

type Stats = {
  reported: number;
  open: number;
  in_progress: number;
  verified: number;
  helpers: number;
  median_days_to_fix: number | null;
};

const FLOW = [
  { icon: Camera, title: "1. Spot & Report", body: "Snap a photo, drop a pin. Takes 20 seconds. No red tape." },
  { icon: Users, title: "2. Community Confirms", body: `${RULES.confirmThreshold} peers confirm it's real. False alarms get filtered out.` },
  { icon: Hand, title: "3. Someone Claims It", body: "A peer or verified helper takes ownership to resolve it." },
  { icon: Wrench, title: "4. Take Action", body: "Fix it, gather materials, or pool resources together." },
  { icon: CheckCircle2, title: "5. Verify Together", body: "Peers check the fix on the spot. If it's done, we celebrate." },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden selection:bg-brand/30 selection:text-brand-950">
      {/* Background Blobs for extreme premium feel */}
      <div className="bg-blob bg-brand/30 h-[800px] w-[800px] top-[-200px] left-[-200px] mix-blend-multiply dark:mix-blend-screen" />
      <div className="bg-blob bg-accent/20 h-[600px] w-[600px] top-[10%] right-[-100px] animation-delay-2000 mix-blend-multiply dark:mix-blend-screen" />
      <div className="bg-blob bg-brand-400/20 h-[700px] w-[700px] bottom-[-200px] left-[20%] animation-delay-4000 mix-blend-multiply dark:mix-blend-screen" />

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-24 sm:pt-36 relative z-10 text-center animate-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-surface/50 px-5 py-2 text-sm font-semibold text-brand mb-10 backdrop-blur-md shadow-[0_0_25px_rgba(48,165,140,0.2)] transition-transform hover:scale-105 cursor-default">
          <Sparkles className="size-4 animate-pulse-slow text-accent" />
          <span>A new way to fix our cities, together.</span>
        </div>
        
        <h1 className="mx-auto max-w-5xl text-6xl font-extrabold leading-[1.1] tracking-tighter sm:text-7xl md:text-8xl">
          Don't just complain.
          <br />
          <span className="text-gradient">Solve it with peers.</span>
        </h1>
        
        <p className="mx-auto mt-8 max-w-2xl text-lg text-ink-soft sm:text-xl md:text-2xl leading-relaxed font-medium">
          Sambhal is a community-driven platform where residents report local issues, claim ownership, and verify fixes themselves. No waiting on officials. Real action, by real people.
        </p>
        
        <div className="mt-12 flex flex-col sm:flex-row flex-wrap justify-center gap-5">
          <Link href="/report" className="btn-primary rounded-2xl px-10 py-5 text-lg font-bold shadow-2xl shadow-brand/30 group">
            Start a Report 
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/map" className="btn-secondary rounded-2xl px-10 py-5 text-lg font-bold group border-brand/20 bg-surface/80 backdrop-blur-xl">
            <MapPin className="size-5 text-brand transition-transform group-hover:-translate-y-1 group-hover:text-accent" />
            Explore the Map
          </Link>
        </div>

        <Suspense fallback={<div className="mx-auto mt-20 h-[140px] max-w-4xl animate-pulse rounded-3xl bg-surface-2/50 backdrop-blur-md" />}>
          <LiveStats />
        </Suspense>
      </section>

      {/* How it Works Section */}
      <section className="relative z-10 py-32 border-y border-line/30 bg-surface-2/30 backdrop-blur-3xl">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-20 flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-brand/10 text-brand mb-6 shadow-inner">
              <Activity className="size-8" />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">How the community solves problems</h2>
            <p className="mt-6 text-xl text-ink-soft max-w-2xl mx-auto font-medium">A transparent, step-by-step process that ensures accountability and rewards civic action.</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-5 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-[45px] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-brand/0 via-brand/30 to-brand/0 z-0" />
            
            {FLOW.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="glass-panel p-8 hover:-translate-y-2 group relative z-10 border-white/20 bg-surface/60 backdrop-blur-2xl">
                <div className="absolute inset-0 bg-gradient-to-b from-brand/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-3xl" />
                <div className="relative z-10">
                  <div className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-surface shadow-xl text-brand transition-all duration-500 group-hover:scale-110 group-hover:bg-brand group-hover:text-white group-hover:shadow-brand/40 group-hover:rotate-6">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="font-bold text-xl mb-3 tracking-tight">{title}</h3>
                  <p className="text-sm text-ink-soft leading-relaxed font-medium">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories / Paths Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Every issue has a clear path</h2>
            <p className="mt-6 text-xl text-ink-soft font-medium">
              From broken streetlights to open manholes, our AI instantly suggests the right action plan and alerts the right peers to help.
            </p>
          </div>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PATH_KEYS.map((key) => (
            <div key={key} className="glass-panel p-8 flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group bg-surface/40 hover:bg-surface/80 border-white/10 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 size-32 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" style={{ backgroundColor: PATHS[key].color }} />
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-surface shadow-md border border-line/50">
                    <span className="block size-4 rounded-full shadow-inner" style={{ backgroundColor: PATHS[key].color }} />
                  </div>
                  <h3 className="font-bold text-2xl group-hover:text-ink transition-colors tracking-tight">{PATHS[key].label}</h3>
                </div>
                <p className="flex-1 text-base text-ink-soft leading-relaxed font-medium mb-8">{PATHS[key].blurb}</p>
                <div className="mt-auto pt-6 border-t border-line/50">
                  <p className="text-xs font-bold tracking-widest text-ink/50 uppercase">Led by</p>
                  <p className="font-semibold text-ink mt-1">{PATHS[key].who}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Suspense fallback={<div className="py-32" />}>
        <LatestReports />
      </Suspense>

      {/* CTA Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-32">
        <div className="glass-panel relative overflow-hidden p-10 sm:p-16 flex flex-col md:flex-row items-center gap-10 bg-gradient-to-br from-brand/10 via-brand/5 to-accent/10 border-white/20 shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldCheck className="size-64" />
          </div>
          
          <div className="relative z-10 shrink-0">
            <div className="flex size-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-brand to-brand-600 text-white shadow-[0_0_40px_rgba(48,165,140,0.5)]">
              <ShieldCheck className="size-12" />
            </div>
          </div>
          
          <div className="relative z-10 flex-1 text-center md:text-left">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight">Step up for your community</h2>
            <p className="text-ink-soft text-xl max-w-2xl font-medium leading-relaxed">
              Got a few hours on a weekend? Good at rallying people? Or simply care about your street? Join the network of peers ready to pool their time and solve things together.
            </p>
          </div>
          
          <div className="relative z-10 shrink-0 mt-6 md:mt-0">
            <Link href="/me#helper" className="btn-primary rounded-2xl py-5 px-10 text-lg font-bold shadow-2xl shadow-brand/40 transition-transform hover:scale-105">
              Join the Effort
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

async function LiveStats() {
  await connection();
  const supabase = await createClient();
  const { data: stats } = await supabase.rpc("public_stats").single<Stats>();
  
  // Use a fallback just for the visual if there's no data
  const safeStats = stats || { reported: 0, in_progress: 0, verified: 0, helpers: 0 };
  
  return (
    <div className="mt-20 mx-auto max-w-5xl glass-panel p-8 sm:p-12 relative overflow-hidden group bg-surface/50 border-white/20 shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-accent/5 opacity-50" />
      <dl className="grid grid-cols-2 gap-y-12 gap-x-8 sm:grid-cols-4 sm:divide-x divide-line/30 relative z-10">
        {[
          ["Issues Reported", safeStats.reported],
          ["In Progress", safeStats.in_progress],
          ["Successfully Fixed", safeStats.verified],
          ["Peers Ready", safeStats.helpers],
        ].map(([label, value], i) => (
          <div key={label} className={`flex flex-col items-center justify-center px-4 ${i === 0 ? 'pl-0 sm:border-l-0' : ''} ${i === 3 ? 'pr-0' : ''}`}>
            <dd className="text-5xl sm:text-6xl font-black tabular-nums tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-ink to-ink-soft dark:from-white dark:to-white/50 mb-3 drop-shadow-sm">
              {value}
            </dd>
            <dt className="text-sm font-bold tracking-widest text-ink-soft uppercase text-center">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function LatestReports() {
  await connection();
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("problems")
    .select(PROBLEM_CARD_COLUMNS)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(4)
    .overrideTypes<Card[], { merge: false }>();
    
  if (!recent || recent.length === 0) return null;
  
  return (
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-32 bg-gradient-to-b from-surface-2/10 to-surface-2/40 rounded-[3rem] mb-32 border border-white/10 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-end justify-between mb-16 gap-6 px-4 md:px-8">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-extrabold tracking-tight">Recent activity in the community</h2>
            <p className="mt-4 text-xl text-ink-soft font-medium">See what your peers are reporting and fixing right now.</p>
          </div>
          <Link href="/map" className="btn-secondary rounded-xl py-3 px-6 whitespace-nowrap shadow-sm group">
            <span className="font-semibold">View Map</span> <ArrowRight className="size-4 ml-1 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 px-4 md:px-8">
          {recent.map((p) => (
            <div key={p.id} className="h-full">
              <ProblemCard problem={p} />
            </div>
          ))}
        </div>
      </section>
  );
}
