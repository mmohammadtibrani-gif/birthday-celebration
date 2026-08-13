# Birthday Celebration Site

A multi-section, scroll-driven 3D birthday website (Three.js) with a real backend
that saves everything — the name, message, target date, photos, and a public
guestbook wall — to a file on the server, so it persists for every visitor.

## What's actually in here

- **Frontend** (`public/`): one continuous 3D scene the camera flies through as
  you scroll — stars, balloons, a floating countdown ring, a cake with 5
  clickable candles, and a fireworks system. Six sections: Hero, Countdown,
  Message, Cake, Photo Wall, Guestbook.
- **Backend** (`server.js`): plain Node.js, **zero npm dependencies** — no
  `npm install` needed, no internet access required to run it. It serves the
  site and reads/writes `data/db.json` for persistence.
- No user accounts, no encryption, no rate-limiting beyond basic size caps.
  This is a personal-project backend, not a hardened production system —
  fine for a birthday page shared with friends and family, not something I'd
  put sensitive data behind.

## Run it locally

You need [Node.js](https://nodejs.org) 18+ installed. Then:

```bash
cd birthday-site
node server.js
```

Open `http://localhost:3000`. Edit any text by clicking it, upload photos,
set the countdown date, and try the guestbook — it all saves to
`data/db.json` immediately.

## Put it on the real internet (so anyone can visit it)

Your own machine isn't reachable from the internet by default, so to get a
real URL you (or someone) need to deploy it. All of these have a free tier
that's enough for this:

1. **Render.com** — connect a GitHub repo with this code, set the start
   command to `node server.js`, done. Free tier sleeps after inactivity
   (first visit after a while takes ~30s to wake up).
2. **Railway.app** — same idea, slightly less generous free tier now than it
   used to be.
3. **Fly.io** — a bit more setup (a `fly.toml`), but a solid free tier and no
   sleep.

Whichever you pick, the flow is the same: push this folder to a GitHub repo,
connect that repo to the host, tell it to run `node server.js`, and it gives
you a public URL.

**One real limitation to know about:** all of these free tiers wipe the
filesystem on redeploy or restart, which means `data/db.json` — your saved
content and guestbook — can get reset. For a birthday page that lives for a
week or two, that's usually fine. If you want it to survive indefinitely
across redeploys, the fix is swapping the JSON file for a small hosted
database (e.g. a free Supabase or Neon Postgres instance) — I can build that
version too if you want it, it's a moderate rewrite of the storage layer in
`server.js`, not the frontend.

## File map

```
birthday-site/
  server.js          <- backend, no dependencies
  package.json
  data/db.json        <- your saved content + guestbook (auto-created)
  public/
    index.html
    style.css
    app.js            <- Three.js scene + all frontend logic
```
