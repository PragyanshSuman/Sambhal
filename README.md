<div align="center">
  <img src="public/favicon.ico" alt="Sambhal Logo" width="100" />

  <h1 align="center">Sambhal</h1>

  <p align="center">
    <strong>Don't just complain. Solve it with peers.</strong>
    <br />
    A community-driven platform where residents report local issues, claim ownership, and verify fixes themselves. No waiting on officials. Real action, by real people.
  </p>

  <p align="center">
    <a href="#-features"><strong>Features</strong></a> ·
    <a href="#-the-process"><strong>The Process</strong></a> ·
    <a href="#-tech-stack"><strong>Tech Stack</strong></a> ·
    <a href="#-getting-started"><strong>Getting Started</strong></a> ·
    <a href="#-deploying"><strong>Deploying</strong></a>
  </p>
</div>

<hr />

## ✨ Features

Everything runs at zero marginal cost: no paid APIs are required.

**Report and resolve**
- 🗺️ **Live map** of problems, updated in real time.
- ⚡ **Instant suggestions** as you type, in English, Hindi or Hinglish: category, urgency, path, skills and safety tips. Keyword rules in the browser, so it's instant and free.
- 🛤️ **Six action paths**: danger, peers, skill, funding, owner, collective. Each has its own guidance, and owner/collective/funding problems get ready-made notices, collective asks, appeals and RTI applications in English or Hindi.
- 🧹 **Cleanup drives**: date, meeting point and checklist; RSVPs; calendar invites; WhatsApp invites; reminders the day before.
- 🏘️ **Neighbourhood pages** with a leaderboard, "fixed this month", the longest-open problems, and a one-tap WhatsApp weekly update.
- 📊 **Public impact dashboard**: time to fix, fix rate per neighbourhood, a before/after gallery.
- 🖼️ **Rich WhatsApp previews**: shared links unfurl into a card, which becomes a before/after card once fixed.

**Trust and safety**
- ✅ **On-the-spot checks**: confirming or verifying needs your location within 300 m *and* a photo uploaded in the last 20 minutes. New accounts count half.
- 🙈 **Blur faces and number plates** before upload: tap to blur, or find faces automatically (on-device, MediaPipe).
- 🚩 **Flag content**: 3 flags hide it until a moderator reviews it. Moderators can hide/restore content and suspend users; every action is logged.
- ⚖️ **Grievance officer page and complaint form** (IT Rules 2021), privacy notice, community rules, data download and account deletion (DPDP Act 2023).
- 🛡️ All rules are enforced in Postgres (functions, triggers, row-level security, rate limits), not just the UI.

**Built for India**
- 🇮🇳 **Hindi and English** throughout (more languages = one dictionary file).
- 📱 **Installable app (PWA)** with **free push notifications** and an offline page.
- ☎️ **Phone OTP sign-in**, ready to switch on (needs a paid SMS provider; free test numbers locally).

**Operations**
- Error alerts to Slack/Discord, privacy-friendly page-view analytics, an activity dashboard for moderators, nightly encrypted backups, uptime checks, and CI. All free.

## 🔄 The Process

1. 📸 **Spot & Report:** Snap a photo, blur anything private, drop a pin. Takes 20 seconds.
2. ✅ **Community Confirms:** Two neighbours confirm it on the spot, with a fresh photo. False alarms get filtered out.
3. 🙋 **Someone Claims It:** A neighbour or helper takes ownership. Go quiet for a week and it opens up again.
4. 🏗️ **Take Action:** Fix it, plan a cleanup drive, pool materials, or send a notice or collective ask.
5. 🎉 **Verify Together:** Two neighbours check the fix on the spot. The fixer earns trust points.

## 🚀 Tech Stack

- **Frontend:** [Next.js 16](https://nextjs.org/) (App Router, Cache Components), React 19, Tailwind CSS 4, Lucide icons
- **Maps:** [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles; neighbourhood names from OpenStreetMap Nominatim
- **Backend:** [Supabase](https://supabase.com/): Postgres + PostGIS, Auth (email/phone OTP), Storage, Realtime, pg_cron, pg_net
- **Push:** Web Push with VAPID (`web-push`)
- **Face detection:** [MediaPipe](https://ai.google.dev/edge/mediapipe) Face Detector, on-device
- **i18n:** `[lang]` route segment + `next/root-params`; URLs stay unprefixed (the proxy picks the language from a cookie or the browser)

## 💻 Getting Started

```bash
git clone https://github.com/yourusername/sambhal.git
cd sambhal
npm install
npx supabase start          # needs Docker; applies migrations and loads demo data
cp .env.example .env.local  # then fill in the two Supabase values from `npx supabase status`
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo accounts:** asha, ravi, meera, imran `@example.com`. Sign in with the 6-digit code from the local mail viewer at http://127.0.0.1:54324. **Asha is a moderator** (see `/admin`).

**Phone sign-in locally:** set `NEXT_PUBLIC_PHONE_AUTH=true`, restart Supabase (`npx supabase stop && npx supabase start`), and use `99000 00001` with code `123456`.

## ✅ Checks

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run test:db     # pgTAP tests for every database rule (needs `supabase start`)
npm run check       # all three
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, build and the database tests on every push and PR.

## 🚢 Deploying

1. **Database:** create a Supabase project, then `npx supabase link` and `npx supabase db push`.
2. **Auth:** in Supabase Auth settings, set the Site URL to your domain, add `https://<your-domain>/**` to the redirect URLs, and use `supabase/templates/sign-in.html` for the Magic Link and Confirm signup templates.
3. **App:** deploy to Vercel (or any Node host) with the variables from `.env.example`. At minimum: the Supabase URL and key, `NEXT_PUBLIC_SITE_URL`, and the grievance officer details.
4. **Moderators:** in the Supabase SQL editor:
   ```sql
   insert into public.moderators (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
5. **Push notifications (free):** `npx web-push generate-vapid-keys`, put the keys and a random `PUSH_WEBHOOK_SECRET` in the app's environment, then tell the database where to send notifications:
   ```sql
   insert into private.settings (key, value) values
     ('push_webhook_url', 'https://<your-domain>/api/push'),
     ('push_webhook_secret', '<same PUSH_WEBHOOK_SECRET>')
   on conflict (key) do update set value = excluded.value;
   ```
6. **Error alerts (optional):** set `ERROR_WEBHOOK_URL` to a Slack or Discord incoming webhook.
7. **Backups:** add `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` as GitHub repository secrets. `.github/workflows/backup.yml` stores an encrypted dump every night for 30 days.
8. **Uptime:** add a `SITE_URL` repository variable. `.github/workflows/uptime.yml` checks `/api/health` every 15 minutes and GitHub emails you if it fails.
9. **Phone sign-in (optional, paid):** enable an SMS provider in Supabase Auth (Twilio, MessageBird, Textlocal or Vonage) and set `NEXT_PUBLIC_PHONE_AUTH=true`.

Before launch, have a lawyer review `src/content/legal.ts` (privacy notice and community rules).

---

<div align="center">
  <sub>Built with ❤️ by the Sambhal Community.</sub>
</div>
