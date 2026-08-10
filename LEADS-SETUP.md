# Leads Dashboard — setup guide

The dashboard is a static page. It holds no data of its own: it reads a Google
Sheet that Zapier keeps topped up from InvestorFuse.

```
InvestorFuse  ──(Zapier, on every new lead)──▶  Google Sheet  ──(published CSV)──▶  leads.html
```

Nothing is stored on a server, there are no API keys in the repo, and the sheet
link lives in your browser's local storage.

---

## Step 1 — Make the Google Sheet

Create a sheet named something like **CROF Lead Feed**, with this header row.
Only the first two columns are required; everything else lights up an extra
part of the dashboard when you add it.

| Column | Required | What it powers |
|---|---|---|
| `Date` | **yes** | Daily volume, weekly totals, the dip analysis. Include the time (`2026-08-10 14:32`) — speed-to-lead needs it. |
| `Campaign` | **yes** | Every per-campaign breakdown. This is the InvestorFuse **lead source** field. |
| `Lead Name` | no | Row labels in the export |
| `Stage` | no | Funnel conversion (recognises InvestorFuse stage names) |
| `First Contact` | no | Speed to lead — needs a full date **and** time |
| `Appointment` | no | Funnel — `yes`, or the appointment date |
| `Contract` | no | Funnel — `yes`, or the contract date |
| `Closing` | no | Funnel — `yes`, or the closing date |
| `Revenue` | no | ROAS (fill in on closed deals only) |
| `Owner` | no | Included in exports |

Header names are matched loosely, so `Date Created`, `Created At`, `Lead Source`,
`Marketing Source`, `Net Profit` and similar all work. Column order does not
matter.

### Campaign naming matters more than anything else here

The dip analysis is only as good as the campaign field. Keep the names **stable
and consistent** — `SEO CRMD` and `SEO - CRMD` and `seo crmd` count as three
different campaigns and will look like one campaign dying and another appearing.
Pick a convention in InvestorFuse and don't rename mid-quarter.

---

## Step 2 — The Zap

1. In Zapier, create a Zap with **InvestorFuse** as the trigger app and choose
   its new-lead trigger.
   *If your InvestorFuse plan doesn't expose a trigger:* use **Webhooks by
   Zapier → Catch Hook** as the trigger instead, and point an InvestorFuse
   outbound webhook (Settings → Integrations/Automations) at the URL Zapier
   gives you. Same result.
2. Action: **Google Sheets → Create Spreadsheet Row**.
3. Map the fields to the columns above. Map the lead's **created timestamp** to
   `Date` and its **lead source** to `Campaign`.
4. Turn the Zap on and submit one test lead to confirm a row lands.

**Why not have the dashboard talk to InvestorFuse directly?** Its Zapier
integration is push-only — it accepts data but exposes no way to read leads
back out. So the sheet is not a workaround, it's the data store: it's the only
place a full lead history can accumulate.

---

## Step 3 — Backfill history

Week-over-week comparison needs history, and the Zap only captures leads from
the moment you switch it on. Do this once:

1. Export your leads from InvestorFuse (as far back as it will give you).
2. Line the columns up with the header above.
3. Paste the rows **beneath** the header in the same sheet.

Ninety days is plenty — that gives the 4-week trailing average real ground to
stand on. Without a backfill the dashboard works, but it can't say "below its
norm" until about five weeks of Zap data have built up.

---

## Step 4 — Publish the sheet

**File → Share → Publish to web →** pick the tab **→ Comma-separated values
(.csv) → Publish.** Copy the link.

> Publishing makes that tab readable by anyone with the link. Keep the sheet to
> lead counts, campaigns and stages — don't put seller phone numbers or email
> addresses in it.

"Publish to web" is not the same as the sharing dialog's link — a normal
share link will make the page show *"Google returned a web page instead of
CSV."*

---

## Step 5 — Point the dashboard at it

Open the dashboard, click **⚙ Data source**, paste the published CSV link, pick
a refresh interval, and save. The link is remembered in that browser.

To hand someone a dashboard that's already connected, append the link as a
query parameter:

```
https://your-site.netlify.app/leads?sheet=<published-csv-url>
```

Handy for a presentation laptop or a wall display.

### Ad spend (optional — powers cost per lead and ROAS)

A second sheet with `Week Of`, `Campaign`, `Spend` — one row per campaign per
week. Publish it as CSV too and paste the link into the spend field. Cost per
lead appears as soon as spend is connected; ROAS also needs the `Revenue`
column filled in on closed deals.

---

## How "real time" it actually is

| Hop | Delay |
|---|---|
| InvestorFuse → Zapier | instant on a webhook trigger; up to 1–15 min if the Zap polls (depends on your Zapier plan) |
| Zapier → Google Sheet | a few seconds |
| Sheet → dashboard | your refresh interval (default 1 minute), plus Google's CSV cache of up to ~5 minutes |

So: **a new lead typically shows up within 1–5 minutes.** The pill in the top
right tells you how stale the current numbers are, so nobody has to guess
whether the page is live. If you need sub-second updates, that needs a real
database instead of a sheet — worth doing only if the minute-scale delay
actually gets in the way.

---

## Reading the dip analysis

The **Week-over-week campaign dip** section answers "what caused the drop."

- Weeks run **Monday–Sunday** and are labelled the way the team talks: `Aug W2`
  is the week starting on the 2nd Monday of August.
- The default comparison is the **latest complete week** against the one before
  it. You can pick any week in the *Compare week* filter.
- Choosing the current, still-running week compares **like for like** — its
  first N days against the prior week's first N days. Three days versus seven
  isn't a dip, it's an artefact, and the chart says which mode it's in.
- **Share of decline** is the honest attribution number: of all the leads lost
  this week, what percentage this one campaign accounts for. It's the sentence
  worth quoting in a meeting.
- **vs 4-week average** is the sanity check. A campaign that does 6, 2, 7, 3 is
  noisy, not dying. One flagged *Below its norm* is more than 25% under its own
  recent average, so the drop is unusual for that campaign specifically.

The analysis is deliberately **diagnostic, not predictive** — it attributes a
change that already happened rather than forecasting one. Every number is
arithmetic you can reproduce in the sheet, which is what you want when someone
in the room asks where a figure came from.

---

## Notes

- **Nine or more campaigns:** the eight biggest get a fixed colour; the rest are
  grouped as *Other* in the charts and stay itemised in the exported CSV.
- **Presenting:** the ⚙ theme button toggles light/dark, *Show data tables* puts
  the numbers behind every chart on screen, and printing the page keeps the
  tables and drops the controls.
- **Nothing loading?** Check the sheet is *published to web* (Step 4), that the
  header row matches, and that the `Date` column holds real dates rather than
  text.
