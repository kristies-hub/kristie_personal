# Kristie's Task Planner ✅

A simple personal website for prioritizing tasks so nothing urgent slips through the cracks.

## What it does

- **☀️ Today** — the first thing you see when you open the site. Overdue and urgent tasks are pinned to the top with a big "finish these first" banner, followed by today's recurring tasks, then medium and low priority items, then a preview of the week ahead.
- **📅 Calendar** — a month view with every task color-coded by priority (red = urgent, yellow = medium, green = low, purple = recurring). Click any day to see or add tasks.
- **🗂️ All Tasks** — every open task grouped by priority.
- **🔁 Recurring** — repetitive tasks (e.g. "Update Peter's sheet — every Thursday") that automatically appear on the Today page on their scheduled days. Supports daily, weekly (one or more weekdays), and monthly schedules.
- **🏆 Completed** — everything you've checked off, grouped by date, with "done today / last 7 days / all time" counters for motivation.

## Where the data lives

All tasks are saved automatically in your browser's local storage — nothing is uploaded anywhere. Use **⬇ Export backup** (bottom of the page) every so often to save a JSON backup file, and **⬆ Import backup** to restore it or move to another browser/computer.

## Running it

It's a static site — no build step, no dependencies. Open `index.html` in a browser, or serve the folder with GitHub Pages.

### Enabling GitHub Pages

1. Merge this branch into `main`.
2. On GitHub: **Settings → Pages → Source: GitHub Actions** (a deploy workflow is included in `.github/workflows/pages.yml`), **or** choose **Deploy from a branch → main → / (root)**.
3. The site will be live at `https://kristies-hub.github.io/kristie_personal/`.
