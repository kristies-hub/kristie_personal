# Leads Dashboard — setup guide

The dashboard is a static page. It holds no data of its own: it reads a Google
Sheet that Zapier keeps topped up from InvestorFuse.

```
InvestorFuse  ──(Zapier, on every new lead)──▶  Google Sheet  ──(published CSV)──▶  leads.html
```

Nothing is stored on a server, there are no API keys in the repo, and the sheet
link lives in your browser's local storage.

**Until you connect the live sheet** the page reads `leads-history.csv` — your
real InvestorFuse export, 3,301 leads from 2 Jan 2025 to 10 Aug 2026 — so every
chart and the scorecard work out of the box. The pill top-right says
*"CRM history (not live)"* so nobody mistakes it for live data.

> **What is in `leads-history.csv`:** only the dates and the campaign — created,
> qualified, 1st appointment, 1st offer, contract, closed, cancelled. Seller
> names, emails, phone numbers, addresses and the full call transcripts from the
> original export were **deliberately left out**. This file sits in a git repo
> behind a published web page, which is not a place for seller PII, and the
> dashboard never needed it.

---

## Weeks run Sunday → Saturday

This matters more than it sounds. Bloom Growth's scorecard uses
**Sunday–Saturday** weeks, so the dashboard does too. If it used Monday-start
weeks every weekly number would be shifted by a day and would quietly disagree
with the scorecard already on screen in the L10 — the fastest way to lose the
room's trust in a dashboard.

Week labels read `Aug W2`, meaning the week starting on the 2nd Sunday of
August, with the date range shown next to it.

---

## Step 1 — Make the Google Sheet

Create a sheet named something like **CROF Lead Feed**. Header names are matched
loosely, so **InvestorFuse's own export column names work as-is** — that's what
the columns below are.

| Column | Required | What it powers |
|---|---|---|
| `Date Created` | **yes** | Daily volume, weekly totals, dip analysis, New Leads |
| `Campaign` | **yes** | Every per-campaign breakdown |
| `Date Qualified` | no | Qualified Leads + Qualified Rate, funnel |
| `Date of 1st Appointment` | no | Appointments Set, funnel |
| `Date of 1st Offer` | no | Offers Made, Same-Day Offers, funnel |
| `Contract Date` | no | Contracts Signed, funnel |
| `Date Closed` | no | Deals Closed, funnel |
| `Date Cancelled` | no | Fall Outs |
| `First Contact` | no | Speed to lead — needs a date **and time** |
| `Revenue` / `Net Profit` | no | ROAS (fill in on closed deals only) |

Milestone columns accept either a **date** (`08-11-2026`) or a plain flag
(`yes`). A date is much better: the scorecard counts each milestone in the week
it actually happened, which a flag can't tell it.

`Date Created` in the InvestorFuse export has **no time component**, which is
why *Speed to lead* shows as unavailable. If you want that panel, map the lead's
full created timestamp into the sheet from Zapier rather than from an export.

### Campaign naming is the thing most likely to break this

Your current export has **39 distinct campaign names that are really 25.** The
dashboard merges the unambiguous duplicates (footer tells you how many), and
you can untick **Merge similar campaign names** to see the raw values:

| Merged into | From |
|---|---|
| `SEO DirectMD` | `SEO DirectMD #1` … `#10` |
| `Skipforce` | `Skipforce Data` |
| `PPC DirectMD Victory` | `PPC Direct MD Victory` *(spacing typo)* |
| `InvestorMachine` | `Old IM` |
| `PPC (legacy)` | `Old PPC (MD Cash Home Buyers)` |
| `Website` | `Website - ibuybmore.com` |

`Motivated Leads` and `Motivated Sellers` are **left separate** on purpose —
those look like two different vendors, and guessing wrong would hide a real
signal. If they are the same spend, add them to `CAMPAIGN_MERGES` in
`leads.js`.

The real fix is upstream: pick a naming convention in InvestorFuse and hold to
it. Left alone, a renamed campaign reads as one campaign dying and a new one
appearing — the exact false alarm this dashboard exists to catch.

---

## Step 2 — The Zap

1. In Zapier, create a Zap with **InvestorFuse** as the trigger app and choose
   its new-lead trigger.
   *If your InvestorFuse plan doesn't expose a trigger:* use **Webhooks by
   Zapier → Catch Hook** as the trigger, and point an InvestorFuse outbound
   webhook (Settings → Integrations/Automations) at the URL Zapier gives you.
2. Action: **Google Sheets → Create Spreadsheet Row**.
3. Map the fields to the columns above.
4. Turn the Zap on and submit one test lead to confirm a row lands.

**Why not have the dashboard talk to InvestorFuse directly?** Its Zapier
integration is push-only — it accepts data but exposes no way to read leads back
out. So the sheet is not a workaround, it's the data store: it's the only place
a full lead history can accumulate.

A new-lead Zap only captures leads from the moment you switch it on. To keep the
history, paste the rows from `leads-history.csv` (or a fresh InvestorFuse
export) beneath the header in the same sheet.

---

## Step 3 — Publish the sheet

**File → Share → Publish to web →** pick the tab **→ Comma-separated values
(.csv) → Publish.** Copy the link.

> Publishing makes that tab readable by anyone with the link. Keep it to dates,
> campaigns and stages — don't put seller phone numbers or email addresses in
> it.

"Publish to web" is not the same as the sharing dialog's link — a normal share
link makes the page show *"Google returned a web page instead of CSV."*

---

## Step 4 — Point the dashboard at it

Open the dashboard, click **⚙ Data source**, paste the published CSV link, pick
a refresh interval, and save. The link is remembered in that browser.

To hand someone a dashboard that's already connected:

```
https://your-site.netlify.app/leads?sheet=<published-csv-url>
```

Handy for a presentation laptop or a wall display.

### Ad spend (optional — powers cost per lead and ROAS)

A second sheet with `Week Of`, `Campaign`, `Spend` — one row per campaign per
week. Publish it as CSV too and paste the link into the spend field.

---

## The weekly scorecard

Same layout as the Bloom L10: measures down the side, Sunday–Saturday weeks
across the top newest-first, cells tinted against goal.

- **Goals are yours to set** — ⚙ Data source → *Scorecard goals*. They seed from
  the numbers visible in your Bloom screenshot (New Leads ≥ 40, Qualified ≥ 50%,
  Same-Day Offers ≥ 4, Contracts Signed ≥ 4, Fall Outs = 0); the rest are
  placeholders until you set them.
- **Milestones count in the week they happened**, not the week the lead came in.
  A lead from June that goes under contract in August counts in August — which
  is how a scorecard should read.
- **The current week is shown but never graded.** A Tuesday total judged against
  a full-week goal is always a miss, and a column of false red teaches people to
  ignore the colour.
- **Cells tinted amber** are within 25% of goal; red is further off. Every miss
  also carries a `!` or `✗` glyph, so the grid never depends on colour alone.
- **Sum and Avg cover the weeks shown.** The scorecard uses its own week count,
  not the date-range filter.

### How it compares to Bloom's own numbers

Recomputing New Leads from this export against the Bloom screenshot: 6 of 12
weeks match exactly, and the rest are within 5 (e.g. 35 vs 34 for 26 Jul). The
gap is expected — Bloom's cells were typed in at the time, while this recomputes
from the CRM as it stands today, and leads get resurfaced, reassigned or deleted
in between (52% of the export carries a `Dead Date`). Treat the dashboard as
current truth and Bloom as the historical record of what was reported.

---

## Reading the dip analysis

The **Week-over-week campaign dip** section answers "what caused the drop."

- Default comparison is the **latest complete week** against the one before it.
  Any week can be picked in *Compare week*.
- Choosing the current, still-running week compares **like for like** — its first
  N days against the prior week's first N days. Three days vs seven isn't a dip,
  it's an artefact, and the chart says which mode it's in.
- **Share of decline** is the honest attribution number: of all leads lost this
  week, what percentage this one campaign accounts for.
- **vs 4-week average** is the sanity check. A campaign that does 6, 2, 7, 3 is
  noisy, not dying. One flagged *Below its norm* is more than 25% under its own
  recent average.

The analysis is **diagnostic, not predictive** — it attributes a change that
already happened. Every number is arithmetic you can reproduce in the sheet,
which is what you want when someone asks where a figure came from.

---

## A note on the funnel panel

The funnel follows a **cohort**: leads created in the selected range, and how far
those same leads have since travelled. Over a short range it will show a low
closing rate simply because those leads haven't had time to close — only 2.2% of
all leads in the export ever reach closed, and closings lag creation by months.
Read it over 90 days or all-time, and read *Deals Closed* on the scorecard for
what actually closed in a given week.

The chart draws at most 5 stages, because a single-hue ramp only has five steps
that stay both distinguishable and legible; when a 6th stage exists it appears in
the data table under the chart rather than getting an invented colour.

---

## Notes

- **Nine or more campaigns:** the eight biggest get a fixed colour, the rest group
  as *Other* in charts and stay itemised in the exported CSV. Colours are
  assigned from all-time volume, so filtering never repaints a campaign.
- **Presenting:** dark is the default; the ☾ button toggles. *Show data tables*
  puts the numbers behind every chart on screen. Printing keeps the tables and
  drops the controls.
- **Nothing loading?** Check the sheet is *published to web*, that the header row
  matches, and that dates are real dates rather than text.
