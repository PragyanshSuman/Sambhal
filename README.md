<div align="center">
  <img src="public/favicon.ico" alt="Sambhal Logo" width="100" />

  <h1 align="center">Sambhal</h1>

  <p align="center">
    <strong>Don't just complain. Solve it with peers.</strong>
    <br />
    A community-driven platform where residents report local issues, claim ownership, and verify fixes themselves. No waiting on officials. Real action, by real people.
  </p>

  <p align="center">
    <a href="#features"><strong>Features</strong></a> · 
    <a href="#the-process"><strong>The Process</strong></a> · 
    <a href="#tech-stack"><strong>Tech Stack</strong></a> · 
    <a href="#getting-started"><strong>Getting Started</strong></a>
  </p>
</div>

<hr />

## ✨ Features

Sambhal is built from the ground up to empower communities. It cuts out the red tape and bureaucracy, connecting people who care with the tools they need to fix their neighborhoods.

- 🗺️ **Interactive Real-Time Map:** Powered by Leaflet. Watch as problems are reported, claimed, and verified in real-time across your community.
- 🤖 **AI-Assisted Triage:** Snap a photo and let our AI instantly categorize the issue, determine the severity, and suggest the best path for resolution.
- 🤝 **Community Validation:** No more false alarms. Problems require confirmation from local peers before they are escalated.
- 🛠️ **Role-Based Action Paths:** Whether it's a danger that needs emergency services, a mess that needs neighbors, or a fix that needs a specific skill—Sambhal categorizes issues dynamically.
- 🏆 **Reputation System:** Earn trust points for reporting real problems, confirming issues, and actively fixing them.

## 🔄 The Process

Sambhal relies on a transparent, community-led 5-step process:

1. 📸 **Spot & Report:** Snap a photo, drop a pin. Takes 20 seconds.
2. ✅ **Community Confirms:** Peers confirm the issue is real. False alarms get filtered out.
3. 🙋 **Someone Claims It:** A verified peer or helper takes ownership to resolve it.
4. 🏗️ **Take Action:** Fix it, gather materials, or pool resources together.
5. 🎉 **Verify Together:** Peers check the fix on the spot. If it's done, we celebrate!

## 🚀 Tech Stack

Sambhal is engineered for speed, reliability, and real-time community engagement.

- **Frontend:** [Next.js](https://nextjs.org/) (React), Tailwind CSS, Lucide Icons
- **Maps:** [Leaflet](https://leafletjs.com/) (Raw implementation for flawless React 19 Strict Mode performance)
- **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL with PostGIS for spatial queries)
- **Real-time:** Supabase Realtime Channels
- **AI:** Edge Functions for intelligent photo triage

## 💻 Getting Started

Follow these steps to run Sambhal locally:

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/sambhal.git
cd sambhal
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Supabase

Make sure you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed.

```bash
supabase start
```

### 4. Setup Environment Variables

Copy the `.env.local.example` (or configure your own `.env.local` file) with the Supabase URL and keys generated from the previous step.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

<div align="center">
  <sub>Built with ❤️ by the Sambhal Community.</sub>
</div>
