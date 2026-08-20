# CR of Maryland — Ops Hub 🔒

The private operations hub for Kristie and Xander. One page that links to every
operations resource, and it also **hosts** the ops sites themselves, so updating
a site means editing a file here — no more opening Netlify and pasting HTML.

Live at: _fill in once deployed_

---

## What's in here

```
cr-ops-hub/
├── index.html              ← the hub page (markup shell only)
├── assets/
│   ├── resources.js        ← ★ THE FILE YOU EDIT. Every card comes from here.
│   ├── styles.css          ← hub styling / brand colours
│   └── hub.js              ← renders the cards + runs search (rarely touched)
├── agents-directory/
│   └── index.html          ← the Agent Referral Directory site
├── referral-leads/
│   └── index.html          ← the Agent Referral Leads site
├── leads-dashboard/
│   └── README.md           ← reserved; see that file to move the dashboard in
├── _headers                ← noindex + security headers
└── robots.txt              ← keeps the site out of Google
```

Each sub-site is a single self-contained HTML file. They don't share the hub's
CSS on purpose — that way editing the hub can never break a site, and vice versa.

---

## How to change something

Everything is plain text. No build step, no npm, nothing to install.

### Add, remove, or re-link a card on the hub

Edit **`assets/resources.js`** only. The comment block at the top of that file
shows the shape of a card. Common jobs:

| You want to… | Do this in `resources.js` |
|---|---|
| Point a "coming soon" card at a real link | Delete its `status: 'soon'` line, add `href: 'https://…'` |
| Add a new resource | Copy any block, change the fields |
| Take a card down for now | Add `hidden: true` to it |
| Add a whole new row/section | Copy a `{ label, title, items: [] }` block |
| Make a card open in a new tab | Add `external: true` |

The number next to each section heading and the "live / listed" count in the
footer are calculated automatically — don't hand-edit those.

### Change what's inside one of the sites

Edit that site's `index.html` directly. For the Agent Referral Directory, the
agent list and the county list are two arrays near the bottom of the file
(`const agents = [...]` and `const geography = [...]`) — add an agent there and
the coverage stats, the county tallies, and the gap warnings all recalculate on
their own.

### Ship it

```bash
git add -A
git commit -m "Add Q3 ops scorecard link"
git push
```

The live site rebuilds itself in under a minute. That's the whole point of this
repo: one push updates the hub and every site it hosts.

---

## Deploying it (one-time setup)

Two steps: put it online, then lock it down. **Do both** — between step 1 and
step 2 the site is publicly reachable by anyone with the URL.

### Step 1 — Cloudflare Pages

1. Sign in at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Authorize GitHub and pick the **`cr-ops-hub`** repo.
3. Build settings — this is a plain static site, so leave them empty:
   - Framework preset: **None**
   - Build command: **(blank)**
   - Build output directory: **`/`**
4. **Save and Deploy.** You'll get a URL like `cr-ops-hub.pages.dev`.

Every push to `main` from now on redeploys automatically.

### Step 2 — Lock it to your two emails (Cloudflare Access)

This is the part that keeps the rest of the team out. It's free for up to 50
users and needs no password — you get a 6-digit code by email.

1. In the Cloudflare dashboard, open **Zero Trust**. First time through it asks
   you to pick a team name (becomes `yourteam.cloudflareaccess.com`) and a plan —
   **choose Free**.
2. Go to **Access → Applications → Add an application → Self-hosted**.
3. Name it `Ops Hub` and set the public hostname to your Pages URL
   (`cr-ops-hub.pages.dev`).
4. Add a policy:
   - Action: **Allow**
   - Include → **Emails** → `kristie@crofmaryland.com` and Xander's email
5. Leave **One-time PIN** as the login method. Save.

Now opening the site prompts for an email; only those two addresses get a code.
Everyone else is turned away at Cloudflare, before the page is ever served.

> **Optional:** if `crofmaryland.com` DNS is on Cloudflare, add a custom domain
> to the Pages project (e.g. `ops.crofmaryland.com`) and point the Access
> application at that hostname instead. Nicer to share, same protection.

Cloudflare moves menu items around from time to time. If the wording doesn't
match, the thing you're looking for is a **self-hosted Access application** with
an **email-based allow policy**.

### Test it before you trust it

Open the URL in a private/incognito window. You should get the Cloudflare login
screen, not the hub. If you see the hub, Access isn't attached yet.

---

## Keeping it private

- **Keep this GitHub repo private.** The hub is only as private as the repo — the
  sub-site HTML contains agent phone numbers, emails, and Google Sheet links.
- `robots.txt` and the `X-Robots-Tag` header in `_headers` keep the site out of
  search results.
- The Google Sheets linked from the referral leads page have **their own** sharing
  settings. Access on this site doesn't protect them. If a sheet is set to
  "anyone with the link", anyone with that link can still open it — worth a pass
  through those sheets' share settings.

## The old Netlify sites

`cr-agents-list-directory` and `cr-agentreferral-lead-sheets` are now served from
this repo. Once you've confirmed the new URLs work, you can delete those two
Netlify sites — or leave them; they'll just go stale. The leads dashboard is
still on Netlify and still linked out to; see `leads-dashboard/README.md` to move
it in.

### Prefer to stay on Netlify?

The repo works there unchanged (`_headers` and `_redirects` are Netlify's own
formats): New site → Import from Git → pick this repo → no build command →
publish directory `/`. You'd lose the email-based login, though — Netlify's
server-side password needs the Pro plan.
