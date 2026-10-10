"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: name.trim() ? { display_name: name.trim() } : undefined,
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      setError(errorMessage(error));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="card mt-8 p-6">
      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="name">
              Your name <span className="font-normal text-ink-soft">(first time only, optional)</span>
            </label>
            <input id="name" maxLength={60} autoComplete="nickname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya from 5th Cross" />
          </div>
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm text-ink-soft">
            We sent a code to <strong className="text-ink">{email}</strong>. You can also tap the link in the email.
          </p>
          <div>
            <label className="label" htmlFor="code">6-digit code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              className="input text-center text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <button className="btn-primary w-full py-2.5" disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button type="button" className="w-full text-sm text-ink-soft underline" onClick={() => setStep("email")}>
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}
