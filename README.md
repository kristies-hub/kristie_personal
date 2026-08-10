# Kristie's Task Planner ✅

A simple personal website for prioritizing tasks so nothing urgent slips through the cracks.

## What it does

- **☀️ Today** — the first thing you see when you open the site. Overdue and urgent tasks are pinned to the top with a big "finish these first" banner, followed by today's recurring tasks, then medium and low priority items, then a preview of the week ahead.
- **📅 Calendar** — a month view with every task color-coded by priority (red = urgent, yellow = medium, green = low, purple = recurring). Click any day to see or add tasks.
- **🗂️ All Tasks** — every open task grouped by priority.
- **🔁 Recurring** — repetitive tasks (e.g. "Update Peter's sheet — every Thursday") that automatically appear on the Today page on their scheduled days. Supports daily, weekly (one or more weekdays), and monthly schedules.
- **🏆 Completed** — everything you've checked off, grouped by date, with "done today / last 7 days / all time" counters for motivation.

## 📈 Leads Dashboard (`leads.html`)

A separate, presentation-ready dashboard for marketing leads (dark by default),
live from InvestorFuse via Zapier → Google Sheet. It has:

- a **weekly scorecard** in the same layout as the Bloom Growth L10 —
  Sunday–Saturday weeks, newest first, cells tinted against goal
- a **week-over-week dip analysis** naming which campaign drove a drop and what
  share of the decline it accounts for
- daily volume, weekly totals by campaign, campaign leaderboard, funnel
  conversion, and cost per lead / ROAS as those columns appear in the sheet

Out of the box it reads `leads-history.csv` — the real InvestorFuse export
(3,301 leads, Jan 2025 – Aug 2026) with all seller PII stripped, so every panel
works before anything is connected.

Setup is one Zap and one published sheet — see **[LEADS-SETUP.md](LEADS-SETUP.md)**.

## Where the data lives

All tasks are saved automatically in your browser's local storage — nothing is uploaded anywhere. Use **⬇ Export backup** (bottom of the page) every so often to save a JSON backup file, and **⬆ Import backup** to restore it or move to another browser/computer.

## Running it

It's a static site — no build step, no dependencies. Open `index.html` in a browser, or serve the folder with GitHub Pages.

### Enabling GitHub Pages

1. Merge this branch into `main`.
2. On GitHub: **Settings → Pages → Source: GitHub Actions** (a deploy workflow is included in `.github/workflows/pages.yml`), **or** choose **Deploy from a branch → main → / (root)**.
3. The site will be live at `https://kristies-hub.github.io/kristie_personal/`.
