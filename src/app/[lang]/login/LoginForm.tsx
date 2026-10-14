"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { errorMessage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

// Phone sign-in needs an SMS provider configured in Supabase (paid per SMS), so it is opt-in.
const PHONE_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH === "true";

/** 10-digit Indian numbers get +91; anything with a + is used as typed. */
function normalizePhone(input: string) {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const local = digits.replace(/^0+/, "");
  return local.length === 10 ? `+91${local}` : `+${local}`;
}

export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<"start" | "code">("start");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const data = name.trim() ? { display_name: name.trim() } : undefined;
    const { error } =
      method === "email"
        ? await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: true,
              data,
              emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
            },
          })
        : await supabase.auth.signInWithOtp({ phone: normalizePhone(phone), options: { shouldCreateUser: true, data } });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } =
      method === "email"
        ? await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" })
        : await supabase.auth.verifyOtp({ phone: normalizePhone(phone), token: code.trim(), type: "sms" });
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
      {step === "start" ? (
        <form onSubmit={sendCode} className="space-y-4">
          {PHONE_ENABLED && (
            <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="tablist">
              {(["email", "phone"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={method === m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold ${method === m ? "bg-surface text-ink shadow-sm" : "text-ink-soft"}`}
                >
                  {m === "email" ? t.login.email : t.login.phone}
                </button>
              ))}
            </div>
          )}
          {method === "email" ? (
            <div>
              <label className="label" htmlFor="email">{t.login.email}</label>
              <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="phone">{t.login.phoneLabel}</label>
              <input
                id="phone"
                type="tel"
                required
                inputMode="tel"
                autoComplete="tel"
                pattern="[+0-9 ]{10,16}"
                className="input"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-soft">{t.login.phoneHint}</p>
            </div>
          )}
          <div>
            <label className="label" htmlFor="name">
              {t.login.name} <span className="font-normal text-ink-soft">{t.login.nameHint}</span>
            </label>
            <input id="name" maxLength={60} autoComplete="nickname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.login.namePlaceholder} />
          </div>
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? t.login.sending : method === "email" ? t.login.sendEmail : t.login.sendSms}
          </button>
          <p className="text-xs text-ink-soft">
            {t.login.consent}{" "}
            <Link href="/terms" className="underline">{t.footer.terms}</Link> ·{" "}
            <Link href="/privacy" className="underline">{t.footer.privacy}</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm text-ink-soft">
            {fmt(t.login.sentTo, { to: method === "email" ? email : normalizePhone(phone) })}{" "}
            {method === "email" && t.login.emailLinkToo}
          </p>
          <div>
            <label className="label" htmlFor="code">{t.login.code}</label>
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
            {busy ? t.login.checking : t.common.signIn}
          </button>
          <button type="button" className="w-full text-sm text-ink-soft underline" onClick={() => setStep("start")}>
            {t.login.differentEmail}
          </button>
        </form>
      )}
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}
