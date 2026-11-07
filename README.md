# 🪔 LET'S GET LIT. IT'S DIWALI! · Party RSVP

A festive, mobile-first RSVP site for a Diwali house party, with Google Sheets as the database.

- **Invite page**: animated diyas, marigold garland, countdown, and event details you can edit.
- **4-level RSVP game**: guest list (with plus ones and a live headcount), food, the **YouTube Watch Party** submission, and what they're looking forward to (cats, board games, cocktails, the watch party, or everything; pick several). A guest who says "No" can send regrets straight from level 1.
- **Confirmation** with fireworks, a calendar invite, and a **party pass** code for voting.
- **Host dashboard** (`/admin`, password protected): RSVPs, videos, Party Control, and event details.
- **Watch party screen** (`/party`) for the TV: gallery and player, and the leaderboard.
- **Guest voting** (`/vote`) on phones: one locked vote each for the **Best Video**, and no voting for your own video.

## How it works

```
Browser (React + Vite)  ──POST JSON──▶  Google Apps Script web app  ──▶  Google Sheet (private)
```

- The Sheet is **never shared publicly**. The Apps Script runs as you and is the only thing that touches it.
  Guests can only make the calls the script allows (submit an RSVP, vote, and so on), so they can never read other guests' data.
- The backend logic lives in `src/server/core.ts`. `npm run build:gas` bundles it into `apps-script/Code.js`, the one file you paste into Apps Script.
  The same logic also runs the in-browser **demo mode**.
- **Video length check**: the script uses YouTube's own API through Apps Script's built-in YouTube service, which needs no API key.
  It checks the length again when the RSVP is submitted, so videos of 15 minutes or more are rejected even if someone bypasses the form.
  If the YouTube service isn't enabled, the script falls back to looking up the title only, and the dashboard flags the video as "Length unknown" for you to check.
- **Duplicate RSVPs**: one RSVP per email or phone number. Guests who come back on the same device edit their RSVP instead of creating a new one.
- **Host login**: a password stored in the script's Script Properties, never in the code. A successful login returns a signed session token that expires after 12 hours.
  Repeated wrong guesses are rate-limited.

## Try it now (demo mode)

```bash
npm install
```

```bash
npm run dev
```

With no `VITE_SHEETS_API_URL` set, the site runs in **demo mode**: data is kept in your browser, with some sample guests and videos.
The host password in demo mode is `diwali`.

## Go live with Google Sheets (about 10 minutes)

1. **Create the Sheet.** Make a new Google Sheet, for example "Diwali RSVPs".
2. **Add the script.** In the Sheet, go to **Extensions → Apps Script**.
   - Replace the contents of `Code.gs` with everything in [`apps-script/Code.js`](apps-script/Code.js).
   - Click ⚙️ **Project Settings** and tick **Show "appsscript.json" manifest file in editor**.
     Back in the editor, replace `appsscript.json` with [`apps-script/appsscript.json`](apps-script/appsscript.json).
     This turns on the YouTube service used for the length checks.
   - In **Project Settings → Script properties**, add `ADMIN_PASSWORD` with the host password of your choice.
3. **Run setup.** Choose `setup` in the function drop-down and click **Run**, then approve the permissions.
   This creates the tabs: Settings, RSVPs, Videos and Votes.
4. **Deploy.** Go to **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**.
   Copy the **Web app URL**, which ends in `/exec`.
5. **Connect the site.** Copy `.env.example` to `.env.local` and set:
   ```
   VITE_SHEETS_API_URL=https://script.google.com/macros/s/XXXX/exec
   ```
6. **Host it.** Run `npm run build` and deploy the `dist/` folder to Vercel or Netlify.
   The SPA rewrite configs are already included in `vercel.json` and `public/_redirects`.
   Set `VITE_SHEETS_API_URL` in the host's environment variables as well.
7. Open `/admin`, sign in, and fill in your **Event Details**: date, time, venue, dress code and so on.

> When you change the script later (for example after `npm run build:gas`), use **Deploy → Manage deployments → Edit → New version**.
> That keeps the same URL.

You can also open the Sheet itself at any time to see the raw data. Avoid editing the `id`, `token_hash` and `owner_hash` columns by hand.

## On the night

1. **Before the party**: in **Videos**, approve or flag each submission. Unverified lengths have a "Check length" button.
2. **Watch**: open `/party` on the TV. Click a tile to play it; Previous/Next walks through the queue.
3. **Vote**: in **Party Control**, click **Open voting**. A QR code appears on the TV, and guests enter their 6-character party pass at `/vote`.
   Plus ones get their own pass. You can look up passes in the RSVPs tab.
4. **Close voting**, then **Reveal results**. The leaderboard and fireworks appear on everyone's screen.
   A **Reset all votes** button is there for after a rehearsal.

There's one award, **🏆 Best Video**. Video categories (Funniest, Most WTF and so on) are just labels that tell everyone what kind of video is coming.

## Exports

- RSVPs → CSV, including plus ones, diet, allergies, what they're looking forward to, and party passes.
- Videos → CSV, including URL, submitter, category, length, status and votes.

## Project layout

```
src/server/core.ts      all backend rules: validation, duplicates, voting, admin actions
src/server/gas.ts       Google Sheets storage + Apps Script web app entry
src/server/types.ts     shared types
src/lib/api.ts          browser client (Sheets or demo)
src/lib/demoBackend.ts  runs core.ts in the browser with localStorage
src/pages/              Landing, Rsvp, Vote, Party, admin/*
apps-script/            GENERATED Code.js + manifest to paste into Apps Script
```

All times are shown in India time (IST), set in `src/lib/format.ts`.

Scripts: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run build:gas`.

## Limits worth knowing

- Apps Script answers in roughly 0.5–2 seconds, which is fine for a house party.
  The party screen and voting pages poll every 5–10 seconds and cache settings, to stay well inside Google's quotas for about 100 guests.
- A guest who RSVPs on one device and then visits on another can't edit from the second device.
  The site tells them to message the hosts, and you can delete their old RSVP in the dashboard so they can resubmit.
