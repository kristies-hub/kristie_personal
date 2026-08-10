/* ═══════════════════════════════════════════════════════════
   Leads Dashboard — app logic

   Pipeline:  InvestorFuse → Zapier → Google Sheet (published
   as CSV) → this page. Nothing is stored server-side; the
   sheet link lives in localStorage (or in the ?sheet= param
   so a dashboard link can be shared ready-to-go).

   No dependencies, no build step — same as the task planner.
   ═══════════════════════════════════════════════════════════ */

(function () {
"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";
const CFG_KEY = "crof-leads-dashboard-v1";

/* ── Palette slots, read from CSS so light/dark swap for free ── */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function seriesColors() {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((i) => cssVar("--series-" + i));
}
function ordinalColors() {
  return [1, 2, 3, 4, 5].map((i) => cssVar("--ord-" + i));
}

/* ═══════════════════════════════════════════════════════════
   1. Config & state
   ═══════════════════════════════════════════════════════════ */

const state = {
  cfg: loadCfg(),
  rows: [],          // normalised lead rows
  spend: [],         // normalised spend rows
  campaignHue: {},   // campaign name → hex (stable, never repainted by a filter)
  campaignList: [],  // top-8 campaigns that own a hue
  source: "none",    // none | sheet | paste | demo
  lastFetch: null,
  fetchError: null,
  fields: {},        // which optional columns were actually found
};

function loadCfg() {
  let cfg = {};
  try {
    cfg = JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
  } catch (e) {
    cfg = {};
  }
  // A ?sheet= / ?spend= param wins, so a link can carry its own source.
  const q = new URLSearchParams(location.search);
  if (q.get("sheet")) cfg.sheet = q.get("sheet");
  if (q.get("spend")) cfg.spend = q.get("spend");
  if (q.get("demo") === "1") cfg.demo = true;
  return {
    sheet: cfg.sheet || "",
    spend: cfg.spend || "",
    paste: cfg.paste || "",
    refresh: cfg.refresh == null ? 60 : Number(cfg.refresh),
    demo: !!cfg.demo,
    // Dark is the house style for this dashboard; the toggle still wins.
    theme: cfg.theme || "dark",
    range: cfg.range || "30",
    merge: cfg.merge !== false,
    scoreWeeks: cfg.scoreWeeks || "13",
    goals: cfg.goals || {},
  };
}

/* Goals are Kristie's numbers, not defaults I get to invent — these seed the
   scorecard from the Bloom L10 where it was visible, and every one is editable
   under ⚙ Data source. */
function goalFor(m) {
  const override = state.cfg.goals[m.key];
  return override == null || override === "" ? m.goal : Number(override);
}

/* The committed CRM history — 2025-01 through the export date, PII stripped.
   Used when no live sheet is configured, so the dashboard is never empty and
   the week-over-week analysis always has history behind it. */
const SEED_CSV = "leads-history.csv";
function saveCfg() {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(state.cfg));
  } catch (e) { /* private browsing — settings just won't persist */ }
}

/* ═══════════════════════════════════════════════════════════
   2. CSV parsing & column mapping
   ═══════════════════════════════════════════════════════════ */

/* Full RFC-4180-ish parser: quoted fields, escaped quotes, CRLF. */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false, i = 0;
  text = text.replace(/^﻿/, "");           // strip BOM
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Column aliases — InvestorFuse exports and Zapier field names vary,
   so match on a normalised header rather than an exact string. */
const ALIASES = {
  date: ["date", "datecreated", "createddate", "created", "createdat", "createdon",
         "leaddate", "dateadded", "timestamp", "submitted", "submittedat", "leadcreated",
         "datereceived", "createdtime"],
  campaign: ["campaign", "campaignname", "leadsource", "leadsourcename", "source",
             "marketingsource", "utmcampaign", "channel", "sourcecampaign", "adcampaign",
             "leadchannel"],
  name: ["leadname", "name", "fullname", "sellername", "contactname", "propertyaddress",
         "address"],
  stage: ["stage", "status", "leadstage", "leadstatus", "pipelinestage", "currentstage",
          "dealstage", "pipeline"],
  contacted: ["contacted", "firstcontact", "firstcontactat", "firstcontacttime",
              "contactedat", "firstresponse", "firstresponseat", "firstattempt",
              "firstcontacted", "timetofirstcontact", "dateoflasttouch"],
  // InvestorFuse's own export headers are the long "Date of 1st …" forms.
  qualified: ["qualified", "datequalified", "qualifieddate", "dateofqualification"],
  appointment: ["appointment", "appointmentdate", "appointmentset", "apptdate", "appt",
                "apptset", "appointmentat", "dateof1stappointment", "dateoffirstappointment",
                "date1stappointment"],
  offer: ["offer", "offerdate", "dateof1stoffer", "dateoffirstoffer", "date1stoffer",
          "offermade", "dateofoffer"],
  contract: ["contract", "contractdate", "undercontract", "contractsigned", "contractat",
             "dateofgoingundercontract"],
  closing: ["closing", "closingdate", "closed", "closeddate", "dateclosed", "closewon",
            "closedwon", "dealclosed", "settlement", "settlementdate", "funded"],
  cancelled: ["cancelled", "canceled", "datecancelled", "datecanceled", "fallout",
              "falloutdate", "cancellationdate"],
  revenue: ["revenue", "profit", "netprofit", "grossprofit", "assignmentfee", "dealvalue",
            "closeamount", "amount"],
  owner: ["owner", "assignedto", "agent", "acquisitionmanager", "assigneduser", "rep"],
};
const SPEND_ALIASES = {
  date: ALIASES.date.concat(["week", "weekof", "month", "monthof", "period", "weekstart"]),
  campaign: ALIASES.campaign,
  spend: ["spend", "cost", "adspend", "amountspent", "budget", "spendusd", "totalspend",
          "costs", "amount"],
};

function mapHeaders(header, aliases) {
  const map = {};
  const slugs = header.map(slug);
  for (const key in aliases) {
    for (const alias of aliases[key]) {
      const idx = slugs.indexOf(alias);
      if (idx !== -1) { map[key] = idx; break; }
    }
  }
  return map;
}

/* ── value coercion ─────────────────────────────────────── */

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;

  // ISO-ish: 2026-08-10 or 2026-08-10 14:32 / T14:32
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return {
      d: new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)),
      hasTime: m[4] != null,
    };
  }
  // US: 8/10/2026 or 08/10/26, optional time + am/pm
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([apAP][mM])?)?/);
  if (m) {
    let year = +m[3];
    if (year < 100) year += 2000;
    let hour = +(m[4] || 0);
    const ampm = (m[7] || "").toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return {
      d: new Date(year, +m[1] - 1, +m[2], hour, +(m[5] || 0), +(m[6] || 0)),
      hasTime: m[4] != null,
    };
  }
  // Fall back to the engine (handles "Aug 10, 2026", RFC strings, etc.)
  const t = Date.parse(s);
  if (!isNaN(t)) return { d: new Date(t), hasTime: /\d{1,2}:\d{2}/.test(s) };
  return null;
}

const FALSEY = ["", "no", "false", "0", "n", "none", "null", "-", "n/a", "na", "#n/a"];
function truthy(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  if (FALSEY.indexOf(s) !== -1) return false;
  return true;
}
function parseNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/[$,\s]/g, "").replace(/[()]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

/* InvestorFuse stage names → funnel depth (1 = new … 5 = closed) */
const STAGE_DEPTH = [
  { depth: 5, words: ["closed", "closedwon", "sold", "funded", "settled", "settlement", "dispod", "won"] },
  { depth: 4, words: ["contract", "undercontract", "pending", "signed", "escrow"] },
  { depth: 3, words: ["appointment", "appt", "apptset", "offer", "offermade", "offersent", "warm", "hot", "negotiating"] },
  { depth: 2, words: ["contacted", "attempting", "attempted", "followup", "nurture", "workingit", "spokento", "qualified", "inprogress"] },
  { depth: 1, words: ["new", "newlead", "unworked", "fresh", "inbound"] },
];
function stageDepth(v) {
  if (!v) return null;
  const s = slug(v);
  for (const band of STAGE_DEPTH) {
    for (const w of band.words) if (s.indexOf(w) !== -1) return band.depth;
  }
  return null;
}

/* ── normalise a leads CSV into rows we can analyse ─────── */
function normaliseLeads(text) {
  const table = parseCSV(text);
  if (!table.length) throw new Error("That CSV is empty.");
  const header = table[0];
  const map = mapHeaders(header, ALIASES);

  if (map.date == null) {
    throw new Error(
      "No date column found. Expected a header like \"Date\", \"Created\" or " +
      "\"Date Created\". Found: " + header.slice(0, 12).join(", ")
    );
  }
  if (map.campaign == null) {
    throw new Error(
      "No campaign column found. Expected a header like \"Campaign\", \"Lead Source\" " +
      "or \"Source\". Found: " + header.slice(0, 12).join(", ")
    );
  }

  const fields = {
    stage: map.stage != null,
    contacted: map.contacted != null,
    qualified: map.qualified != null,
    appointment: map.appointment != null,
    offer: map.offer != null,
    contract: map.contract != null,
    closing: map.closing != null,
    cancelled: map.cancelled != null,
    revenue: map.revenue != null,
    owner: map.owner != null,
    createdHasTime: false,
  };

  const rows = [];
  for (let r = 1; r < table.length; r++) {
    const raw = table[r];
    const cell = (k) => (map[k] == null ? "" : (raw[map[k]] == null ? "" : String(raw[map[k]]).trim()));

    const created = parseDate(cell("date"));
    if (!created) continue;                     // no usable date → skip the row
    if (created.hasTime) fields.createdHasTime = true;

    const campaign = cell("campaign") || "(no campaign set)";
    const depth = stageDepth(cell("stage"));

    const contactedRaw = cell("contacted");
    const contactedAt = parseDate(contactedRaw);

    /* A milestone column may hold a date ("08-11-2026") or just a flag ("yes").
       Keep both readings: the date drives the weekly scorecard (which counts
       events in the week they happened), the flag drives the funnel. */
    const milestone = (key) => {
      if (!fields[key]) return { on: false, at: null };
      const raw = cell(key);
      if (!truthy(raw)) return { on: false, at: null };
      const d = parseDate(raw);
      return { on: true, at: d ? d.d : null };
    };
    const qualified = milestone("qualified");
    const appt = milestone("appointment");
    const offer = milestone("offer");
    const contract = milestone("contract");
    const closing = milestone("closing");
    const cancelled = milestone("cancelled");

    rows.push({
      date: created.d,
      day: dayKey(created.d),
      campaign: campaign,
      rawCampaign: campaign,
      name: cell("name"),
      stage: cell("stage"),
      depth: depth,
      contacted: (contactedRaw ? truthy(contactedRaw) : false) ||
                 qualified.on || (depth != null && depth >= 2),
      contactedAt: contactedAt ? contactedAt.d : null,
      qualified: qualified.on,
      qualifiedAt: qualified.at,
      appt: appt.on || (depth != null && depth >= 3),
      apptAt: appt.at,
      offer: offer.on,
      offerAt: offer.at,
      contract: contract.on || (depth != null && depth >= 4),
      contractAt: contract.at,
      closed: closing.on || (depth != null && depth >= 5),
      closedAt: closing.at,
      cancelled: cancelled.on,
      cancelledAt: cancelled.at,
      revenue: fields.revenue ? parseNum(cell("revenue")) : null,
      owner: cell("owner"),
    });
  }

  if (!rows.length) throw new Error("No rows had a readable date, so there is nothing to chart.");
  rows.sort((a, b) => a.date - b.date);
  return { rows: rows, fields: fields };
}

function normaliseSpend(text) {
  const table = parseCSV(text);
  if (!table.length) return [];
  const map = mapHeaders(table[0], SPEND_ALIASES);
  if (map.campaign == null || map.spend == null) return [];
  const out = [];
  for (let r = 1; r < table.length; r++) {
    const raw = table[r];
    const cell = (k) => (map[k] == null ? "" : (raw[map[k]] == null ? "" : String(raw[map[k]]).trim()));
    const amount = parseNum(cell("spend"));
    if (amount == null) continue;
    const when = parseDate(cell("date"));
    const camp = cell("campaign") || "(no campaign set)";
    out.push({
      date: when ? when.d : null,
      day: when ? dayKey(when.d) : null,
      campaign: camp,
      rawCampaign: camp,
      spend: amount,
    });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════
   3. Date & week helpers  (weeks run Monday → Sunday)
   ═══════════════════════════════════════════════════════════ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayKey(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function pad(n) { return n < 10 ? "0" + n : String(n); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

/* Weeks run SUNDAY → SATURDAY to match the Bloom Growth scorecard. Getting this
   wrong shifts every weekly number by a day and makes the dashboard disagree
   with the numbers already on screen in the L10, so it is not a free choice. */
function weekStartOf(d) {
  const s = startOfDay(d);
  return addDays(s, -s.getDay());          // getDay() 0 = Sunday
}
function weekKey(d) { return dayKey(weekStartOf(d)); }

/* "Aug W2" — which Sunday of its month this week starts on. */
function weekLabel(startKey) {
  const m = parseKey(startKey);
  const nth = Math.floor((m.getDate() - 1) / 7) + 1;
  return MONTHS[m.getMonth()] + " W" + nth;
}
function weekRangeLabel(startKey) {
  const a = parseKey(startKey), b = addDays(a, 6);
  const left = MONTHS[a.getMonth()] + " " + a.getDate();
  const right = (a.getMonth() === b.getMonth() ? "" : MONTHS[b.getMonth()] + " ") + b.getDate();
  return left + "–" + right;
}
/* Bloom's own column header: "2 Aug" over "8 Aug". */
function bloomWeekLines(startKey) {
  const a = parseKey(startKey), b = addDays(a, 6);
  return [a.getDate() + " " + MONTHS[a.getMonth()], b.getDate() + " " + MONTHS[b.getMonth()]];
}
function parseKey(k) {
  const p = k.split("-");
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function shortDay(key) {
  const d = parseKey(key);
  return MONTHS[d.getMonth()] + " " + d.getDate();
}

/* ═══════════════════════════════════════════════════════════
   4. Loading data
   ═══════════════════════════════════════════════════════════ */

/* Accept whatever link is pasted and turn it into something
   fetchable: a published-to-web CSV, or an /edit link that we
   rewrite to the gviz CSV endpoint. */
function normaliseSheetUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/output=csv|\/pub\?|export\?format=csv|tqx=out(:|%3A)csv/i.test(u)) return u;
  const m = u.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  if (m) {
    const gid = (u.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
    return "https://docs.google.com/spreadsheets/d/" + m[1] +
           "/gviz/tq?tqx=out:csv&gid=" + gid;
  }
  return u;
}

/* Google serves published CSV with permissive CORS, but a private
   or oddly-shared sheet can fail. The Netlify redirect in _redirects
   gives us a same-origin second try. */
async function fetchCSV(url) {
  const bust = (url.indexOf("?") === -1 ? "?" : "&") + "_cb=" + Date.now();
  try {
    const res = await fetch(url + bust, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } catch (err) {
    const viaProxy = url.replace(/^https:\/\/docs\.google\.com/, "/sheet-proxy");
    if (viaProxy !== url) {
      const res = await fetch(viaProxy + bust, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status + " (via proxy)");
      return await res.text();
    }
    throw err;
  }
}

async function loadData(isBackground) {
  const main = document.getElementById("main");
  if (isBackground) main.classList.add("is-refetching");

  try {
    let text = null, source = "none";

    if (state.cfg.demo) {
      text = demoCSV();
      source = "demo";
    } else if (state.cfg.sheet) {
      text = await fetchCSV(normaliseSheetUrl(state.cfg.sheet));
      source = "sheet";
      // A private sheet returns Google's HTML sign-in page, not CSV.
      if (/^\s*<(!doctype|html)/i.test(text)) {
        throw new Error(
          "Google returned a web page instead of CSV — the sheet is not published. " +
          "Use File → Share → Publish to web → CSV."
        );
      }
    } else if (state.cfg.paste) {
      text = state.cfg.paste;
      source = "paste";
    } else {
      // Fall back to the committed CRM export so the page is useful on first open.
      text = await fetchCSV(SEED_CSV);
      source = "seed";
    }

    if (!text) {
      state.source = "none";
      state.rows = [];
      state.fetchError = null;
      render();
      return;
    }

    const parsed = normaliseLeads(text);
    state.rows = parsed.rows;
    state.fields = parsed.fields;
    state.source = source;
    state.fetchError = null;
    state.lastFetch = new Date();

    // Spend is optional and must never break the main load.
    state.spend = [];
    if (state.cfg.demo) {
      state.spend = normaliseSpend(demoSpendCSV());
    } else if (state.cfg.spend) {
      try {
        state.spend = normaliseSpend(await fetchCSV(normaliseSheetUrl(state.cfg.spend)));
      } catch (e) {
        state.spend = [];
      }
    }

    applyCampaignNames();
    assignHues();
    buildWeekOptions();
    buildCampaignOptions();
    render();
  } catch (err) {
    state.fetchError = err.message || String(err);
    render();
  } finally {
    main.classList.remove("is-refetching");
  }
}

/* ── Campaign name hygiene ────────────────────────────────
   The live CRM export carries the same campaign under several spellings.
   Left alone they read as one campaign dying and another appearing, which is
   the exact false alarm this dashboard exists to prevent. Only unambiguous
   duplicates are merged; anything that might be a genuinely separate spend
   (Motivated Leads vs Motivated Sellers) is deliberately left apart.
   Edit this list as campaigns come and go, or untick "Merge similar names". */
const CAMPAIGN_MERGES = [
  [/^SEO\s*-?\s*DirectMD(\s*#\s*\d+)?$/i, "SEO DirectMD"],
  [/^PPC\s*Direct\s*MD\s*Victory$/i, "PPC DirectMD Victory"],
  [/^Skipforce(\s*Data)?$/i, "Skipforce"],
  [/^(Old\s*IM|InvestorMachine)$/i, "InvestorMachine"],
  [/^Old\s*PPC\b.*$/i, "PPC (legacy)"],
  [/^Website(\s*-\s*.*)?$/i, "Website"],
];

function canonicalCampaign(name) {
  const s = String(name || "").trim();
  if (!s) return "(no campaign set)";
  for (const [re, canon] of CAMPAIGN_MERGES) if (re.test(s)) return canon;
  return s;
}

/* Recomputed whenever the merge toggle changes — no refetch needed. */
function applyCampaignNames() {
  const on = state.cfg.merge !== false;
  const merged = {};
  state.rows.forEach((r) => {
    const canon = on ? canonicalCampaign(r.rawCampaign) : r.rawCampaign;
    if (canon !== r.rawCampaign) merged[r.rawCampaign] = canon;
    r.campaign = canon;
  });
  state.spend.forEach((s) => {
    s.campaign = on ? canonicalCampaign(s.rawCampaign) : s.rawCampaign;
  });
  state.mergedNames = merged;
}

/* Colour follows the entity: the top 8 campaigns by ALL-TIME volume own
   the hue slots, and among those 8 the slot order is alphabetical — so
   neither a filter nor a rank change ever repaints a campaign. */
function assignHues() {
  const totals = {};
  for (const r of state.rows) totals[r.campaign] = (totals[r.campaign] || 0) + 1;

  const ranked = Object.keys(totals).sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));
  const owners = ranked.slice(0, 8).sort((a, b) => a.localeCompare(b));

  const colors = seriesColors();
  state.campaignHue = {};
  owners.forEach((name, i) => { state.campaignHue[name] = colors[i]; });
  state.campaignList = owners;
  state.otherCampaigns = ranked.slice(8);
}
function hueFor(campaign) {
  return state.campaignHue[campaign] || cssVar("--series-other");
}
/* Campaigns past the 8th slot fold into "Other" — never a generated 9th hue. */
function bucket(campaign) {
  return state.campaignHue[campaign] ? campaign : "Other";
}

/* ═══════════════════════════════════════════════════════════
   5. Analysis
   ═══════════════════════════════════════════════════════════ */

function filters() {
  return {
    range: document.getElementById("fltRange").value,
    campaign: document.getElementById("fltCampaign").value,
    week: document.getElementById("fltWeek").value,
    tables: document.getElementById("fltTables").checked,
  };
}

function rangeBounds(range) {
  const today = startOfDay(new Date());
  if (range === "all") return { from: null, to: addDays(today, 1) };
  if (range === "mtd") return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: addDays(today, 1) };
  const days = Number(range) || 30;
  return { from: addDays(today, -(days - 1)), to: addDays(today, 1) };
}

/* Rows in the selected range + campaign. */
function slice() {
  const f = filters();
  const b = rangeBounds(f.range);
  return state.rows.filter((r) => {
    if (b.from && r.date < b.from) return false;
    if (r.date >= b.to) return false;
    if (f.campaign !== "__all__" && r.campaign !== f.campaign) return false;
    return true;
  });
}

function countBy(rows, keyFn) {
  const out = {};
  for (const r of rows) {
    const k = keyFn(r);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/* Dense daily series across the whole range (zero-filled). */
function dailySeries(rows) {
  const f = filters();
  const b = rangeBounds(f.range);
  const counts = countBy(rows, (r) => r.day);
  const from = b.from || (state.rows.length ? startOfDay(state.rows[0].date) : startOfDay(new Date()));
  const to = addDays(b.to, -1);
  const out = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const k = dayKey(d);
    out.push({ key: k, date: new Date(d), value: counts[k] || 0 });
  }
  return out;
}

function rollingMean(series, window) {
  return series.map((pt, i) => {
    const from = Math.max(0, i - window + 1);
    let sum = 0;
    for (let j = from; j <= i; j++) sum += series[j].value;
    return { key: pt.key, date: pt.date, value: sum / (i - from + 1) };
  });
}

/* Every week present in the data, oldest first. */
function allWeeks() {
  const set = {};
  for (const r of state.rows) set[weekKey(r.date)] = true;
  return Object.keys(set).sort();
}

/* ── The core: attribute a week-over-week change to campaigns ──
   When the focus week is still running we compare like-for-like —
   its first N days against the prior week's first N days — because
   3 days versus 7 is not a dip, it's an artefact. */
function dipAnalysis(focusWeekKey) {
  const f = filters();
  const weeks = allWeeks();
  if (!weeks.length) return null;

  const focus = focusWeekKey && weeks.indexOf(focusWeekKey) !== -1
    ? focusWeekKey
    : latestCompleteWeek(weeks);
  const idx = weeks.indexOf(focus);
  const prior = idx > 0 ? weeks[idx - 1] : null;

  const focusStart = parseKey(focus);
  const today = startOfDay(new Date());
  const elapsed = Math.min(7, Math.max(1, Math.round((today - focusStart) / 86400000) + 1));
  const partial = elapsed < 7;

  // Count a week, optionally capped to its first `days` days.
  const countWeek = (wk, days) => {
    if (!wk) return {};
    const start = parseKey(wk);
    const end = addDays(start, days);
    const out = {};
    for (const r of state.rows) {
      if (r.date < start || r.date >= end) continue;
      if (f.campaign !== "__all__" && r.campaign !== f.campaign) continue;
      const k = bucket(r.campaign);
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  };

  const days = partial ? elapsed : 7;
  const cur = countWeek(focus, days);
  const prev = countWeek(prior, days);

  // Trailing average over the 4 weeks before the prior week, same day-window.
  // A campaign missing from one of those weeks counts as zero for it, so every
  // campaign's average uses the same denominator.
  const trailing = {};
  let trailingWeeks = 0;
  for (let back = 2; back <= 5; back++) {
    const wk = weeks[idx - back];
    if (!wk) continue;
    trailingWeeks++;
    const c = countWeek(wk, days);
    for (const k in c) trailing[k] = (trailing[k] || 0) + c[k];
  }

  const names = {};
  Object.keys(cur).forEach((k) => { names[k] = true; });
  Object.keys(prev).forEach((k) => { names[k] = true; });

  const rows = Object.keys(names).map((name) => {
    const now = cur[name] || 0;
    const before = prev[name] || 0;
    const avg = trailingWeeks ? (trailing[name] || 0) / trailingWeeks : null;
    return {
      campaign: name,
      now: now,
      before: before,
      delta: now - before,
      pct: before === 0 ? (now === 0 ? 0 : null) : (now - before) / before,
      trailingAvg: avg,
      vsTrailing: avg == null || avg === 0 ? null : (now - avg) / avg,
    };
  });

  const totalNow = rows.reduce((s, r) => s + r.now, 0);
  const totalBefore = rows.reduce((s, r) => s + r.before, 0);
  const totalDelta = totalNow - totalBefore;
  const declineTotal = rows.reduce((s, r) => s + (r.delta < 0 ? -r.delta : 0), 0);
  const gainTotal = rows.reduce((s, r) => s + (r.delta > 0 ? r.delta : 0), 0);

  rows.forEach((r) => {
    // Share of the gross decline this campaign is responsible for.
    r.shareOfDecline = r.delta < 0 && declineTotal > 0 ? -r.delta / declineTotal : null;
    r.shareOfGain = r.delta > 0 && gainTotal > 0 ? r.delta / gainTotal : null;
    r.status = classify(r);
  });

  // Biggest movers first: steepest drops at the top.
  rows.sort((a, b) => a.delta - b.delta || b.before - a.before || a.campaign.localeCompare(b.campaign));

  return {
    focus: focus, prior: prior, partial: partial, elapsed: elapsed, days: days,
    rows: rows,
    totalNow: totalNow, totalBefore: totalBefore, totalDelta: totalDelta,
    totalPct: totalBefore === 0 ? null : totalDelta / totalBefore,
    declineTotal: declineTotal,
  };
}

function latestCompleteWeek(weeks) {
  const thisWeek = weekKey(new Date());
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i] !== thisWeek) return weeks[i];
  }
  return weeks[weeks.length - 1];
}

/* Status is always paired with an icon + label in the UI —
   never carried by colour alone. */
function classify(r) {
  if (r.before > 0 && r.now === 0) return { key: "critical", icon: "■", label: "Went quiet" };
  if (r.delta < 0) {
    const drop = r.before > 0 ? -r.delta / r.before : 0;
    if (drop >= 0.5 && -r.delta >= 3) return { key: "critical", icon: "▼", label: "Sharp drop" };
    if (r.vsTrailing != null && r.vsTrailing <= -0.25) return { key: "serious", icon: "▼", label: "Below its norm" };
    return { key: "warning", icon: "▼", label: "Down" };
  }
  if (r.delta > 0) return { key: "good", icon: "▲", label: "Up" };
  return { key: "neutral", icon: "—", label: "Flat" };
}

/* ═══════════════════════════════════════════════════════════
   5b. Bloom-style weekly scorecard
   Rows are measures, columns are Sunday–Saturday weeks newest-first,
   each cell tinted by whether it hit goal — the same shape as the
   Bloom Growth L10 scorecard, so the numbers can be read side by side.
   ═══════════════════════════════════════════════════════════ */

/* Each measure says how to count a week and how to judge it.
   `on` picks WHICH date puts a lead in a week: milestones count in the week
   they happened, not the week the lead came in. */
const SCORECARD = [
  { key: "newLeads", label: "New Leads", goal: 40, cmp: "gte", fmt: "int",
    on: (r) => r.date },
  { key: "qualified", label: "Qualified Leads", goal: 20, cmp: "gte", fmt: "int",
    on: (r) => r.qualifiedAt, needs: "qualified" },
  { key: "qualRate", label: "Qualified Rate", goal: 0.5, cmp: "gte", fmt: "pct",
    ratio: ["qualified", "newLeads"], needs: "qualified" },
  { key: "appts", label: "Appointments Set", goal: 15, cmp: "gte", fmt: "int",
    on: (r) => r.apptAt, needs: "appointment" },
  { key: "offers", label: "Offers Made", goal: 10, cmp: "gte", fmt: "int",
    on: (r) => r.offerAt, needs: "offer" },
  { key: "sameDay", label: "Same-Day Offers", goal: 4, cmp: "gte", fmt: "int",
    on: (r) => (r.offerAt && r.day === dayKey(r.offerAt) ? r.offerAt : null), needs: "offer" },
  { key: "contracts", label: "Contracts Signed", goal: 4, cmp: "gte", fmt: "int",
    on: (r) => r.contractAt, needs: "contract" },
  { key: "closed", label: "Deals Closed", goal: 2, cmp: "gte", fmt: "int",
    on: (r) => r.closedAt, needs: "closing" },
  { key: "fallOuts", label: "Fall Outs", goal: 0, cmp: "eq", fmt: "int",
    on: (r) => r.cancelledAt, needs: "cancelled" },
];

function scorecard(weekCount) {
  const f = filters();
  const rows = state.rows.filter((r) =>
    f.campaign === "__all__" || r.campaign === f.campaign);
  if (!rows.length) return null;

  // Columns: the most recent `weekCount` weeks up to and including this one,
  // so the grid keeps a stable shape even in a week with no activity yet.
  const thisWeek = weekStartOf(new Date());
  const weeks = [];
  for (let i = 0; i < weekCount; i++) weeks.push(dayKey(addDays(thisWeek, -7 * i)));
  const weekSet = {};
  weeks.forEach((w, i) => { weekSet[w] = i; });

  // One pass per measure, bucketing by whichever date that measure keys on.
  const counts = {};
  SCORECARD.forEach((m) => { counts[m.key] = weeks.map(() => 0); });
  rows.forEach((r) => {
    SCORECARD.forEach((m) => {
      if (!m.on) return;
      const d = m.on(r);
      if (!d) return;
      const i = weekSet[weekKey(d)];
      if (i != null) counts[m.key][i] += 1;
    });
  });

  const out = SCORECARD.filter((m) => !m.needs || state.fields[m.needs]).map((m) => {
    let values;
    if (m.ratio) {
      const [num, den] = m.ratio;
      values = weeks.map((w, i) =>
        counts[den][i] > 0 ? counts[num][i] / counts[den][i] : null);
    } else {
      values = counts[m.key].slice();
    }
    // The current week is still running — its cell is shown but not graded,
    // because a Tuesday total judged against a full-week goal is always a miss.
    const partialIdx = 0;
    const graded = values.map((v, i) => (i === partialIdx ? null : judge(m, v)));
    const real = values.filter((v, i) => v != null && i !== partialIdx);
    return {
      measure: m,
      weeks: weeks,
      values: values,
      graded: graded,
      sum: m.fmt === "pct" ? null : values.reduce((s, v) => s + (v || 0), 0),
      avg: real.length ? real.reduce((s, v) => s + v, 0) / real.length : null,
    };
  });

  return { weeks: weeks, rows: out, thisWeek: dayKey(thisWeek) };
}

function judge(m, v) {
  if (v == null) return null;
  const goal = goalFor(m);
  if (m.cmp === "eq") return v === goal ? "good" : "critical";
  return v >= goal ? "good" : (v >= goal * 0.75 ? "warning" : "critical");
}

function fmtScore(m, v) {
  if (v == null) return "—";
  if (m.fmt === "pct") return fmtNum(v * 100, 0) + "%";
  return fmtInt(v);
}
function fmtGoal(m) {
  const sign = m.cmp === "eq" ? "=" : "≥";
  const goal = goalFor(m);
  return sign + " " + (m.fmt === "pct" ? fmtNum(goal * 100, 0) + "%" : fmtInt(goal));
}

/* The grid. Plain HTML table — it is a table of numbers, and building it as
   one means the scorecard IS its own accessible representation. */
function renderScorecard() {
  const host = document.getElementById("scorecard");
  const data = scorecard(Number(state.cfg.scoreWeeks) || 13);

  if (!data) {
    emptyState(host, "No data loaded", "Connect a sheet to fill the scorecard.");
    return;
  }

  host.textContent = "";
  const table = document.createElement("table");
  table.className = "score";

  const cap = document.createElement("caption");
  cap.textContent = "Sunday–Saturday weeks, newest first · Sum and Avg cover the weeks shown · " +
    "the current week is shown but not graded · uses its own week count, " +
    "not the date range above";
  table.appendChild(cap);

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  ["KPI", "Goal", "Sum", "Avg"].forEach((h) => {
    const th = document.createElement("th");
    th.className = "score-head-fixed";
    th.scope = "col";
    th.textContent = h;
    hr.appendChild(th);
  });
  data.weeks.forEach((w) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = "score-head-week" + (w === data.thisWeek ? " is-current" : "");
    const lines = bloomWeekLines(w);
    const a = document.createElement("span");
    a.textContent = lines[0];
    const b = document.createElement("span");
    b.className = "score-head-week2";
    b.textContent = lines[1];
    th.appendChild(a);
    th.appendChild(b);
    if (w === data.thisWeek) {
      const c = document.createElement("span");
      c.className = "score-head-note";
      c.textContent = "now";        // short, so it never widens the column
      th.appendChild(c);
    }
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  data.rows.forEach((row) => {
    const m = row.measure;
    const tr = document.createElement("tr");

    const th = document.createElement("th");
    th.scope = "row";
    th.className = "score-kpi";
    th.textContent = m.label;
    tr.appendChild(th);

    const goal = document.createElement("td");
    goal.className = "score-goal";
    goal.textContent = fmtGoal(m);
    tr.appendChild(goal);

    const sum = document.createElement("td");
    sum.className = "score-agg";
    sum.textContent = row.sum == null ? "—" : fmtScore(m, row.sum);
    tr.appendChild(sum);

    const avg = document.createElement("td");
    avg.className = "score-agg";
    avg.textContent = row.avg == null ? "—" : fmtScore(m, row.avg);
    tr.appendChild(avg);

    row.values.forEach((v, i) => {
      const td = document.createElement("td");
      td.className = "score-cell";
      const status = row.graded[i];
      if (status) td.dataset.status = status;
      if (row.weeks[i] === data.thisWeek) td.classList.add("is-current");

      const val = document.createElement("span");
      val.className = "score-val";
      val.textContent = fmtScore(m, v);
      td.appendChild(val);

      // Misses carry a glyph as well as a tint, so the grid never relies on
      // colour alone. Hits stay bare — marking the exception keeps it readable.
      if (status === "critical" || status === "warning") {
        const flag = document.createElement("span");
        flag.className = "score-flag";
        flag.textContent = status === "critical" ? "✗" : "!";
        td.appendChild(flag);
      }

      td.title = m.label + " · " + weekRangeLabel(row.weeks[i]) + " · " +
        fmtScore(m, v) + " against a goal of " + fmtGoal(m) +
        (status ? (status === "good" ? " · on goal" : " · off goal") : " · week still running");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  host.appendChild(table);
  freezeLeftColumns(table, 4);
}

/* Measure the first `n` columns and pin them at the offsets they actually
   occupy. Guessing these in CSS is what made the frozen block sit on top of
   the first week column — border-spacing and text width both feed into the
   real position, so the only reliable source is the rendered table. */
function freezeLeftColumns(table, n) {
  const firstRow = table.querySelector("tbody tr");
  if (!firstRow) return;
  const tableLeft = table.getBoundingClientRect().left;
  const offsets = [];
  for (let i = 0; i < n; i++) {
    const cell = firstRow.children[i];
    if (!cell) return;
    offsets.push(cell.getBoundingClientRect().left - tableLeft);
  }
  table.querySelectorAll("tr").forEach((tr) => {
    for (let i = 0; i < n; i++) {
      if (tr.children[i]) tr.children[i].style.left = offsets[i] + "px";
    }
  });
}

/* Weekly totals per campaign, for the stacked chart.

   A week is the unit here, so each bar counts its WHOLE Sun–Sat week even
   when the date filter cuts through it. Clipping a week to the range would
   draw a 2-lead stub next to a 36-lead week and read as a collapse. */
function weeklyByCampaign(rows) {
  const f = filters();
  const touched = {};
  for (const r of rows) touched[weekKey(r.date)] = true;

  const weeks = {};
  for (const r of state.rows) {
    const wk = weekKey(r.date);
    if (!touched[wk]) continue;                                  // week not in view
    if (f.campaign !== "__all__" && r.campaign !== f.campaign) continue;
    const c = bucket(r.campaign);
    if (!weeks[wk]) weeks[wk] = {};
    weeks[wk][c] = (weeks[wk][c] || 0) + 1;
  }
  const keys = Object.keys(weeks).sort();
  const campaigns = {};
  keys.forEach((k) => Object.keys(weeks[k]).forEach((c) => { campaigns[c] = true; }));
  const order = state.campaignList.filter((c) => campaigns[c]);
  if (campaigns.Other) order.push("Other");
  return { weeks: keys, data: weeks, campaigns: order };
}

/* Funnel stages, in order, limited to the ones the sheet actually supports.
   The CHART draws at most 5 — a single-hue ordinal ramp has only five steps
   that stay both distinguishable and above the contrast floor — so when a 6th
   stage exists it lives in the table view rather than getting an invented
   colour. Nothing is lost: the table view is the chart's accessible twin. */
const FUNNEL_MAX_BARS = 5;

function funnelData(rows) {
  if (!rows.length) return null;
  const has = state.fields;

  const all = [{ label: "Leads", count: rows.length, always: true }];
  if (has.qualified) all.push({ label: "Qualified", count: rows.filter((r) => r.qualified).length });
  else if (has.contacted || has.stage) all.push({ label: "Contacted", count: rows.filter((r) => r.contacted).length });
  if (has.appointment || has.stage) all.push({ label: "Appointment", count: rows.filter((r) => r.appt).length });
  if (has.offer) all.push({ label: "Offer made", count: rows.filter((r) => r.offer).length });
  if (has.contract || has.stage) all.push({ label: "Contract", count: rows.filter((r) => r.contract).length });
  if (has.closing || has.stage) all.push({ label: "Closed", count: rows.filter((r) => r.closed).length });

  if (all.length < 2) return null;
  return { all: all, bars: all.slice(0, FUNNEL_MAX_BARS) };
}

function speedData(rows) {
  if (!state.fields.contacted || !state.fields.createdHasTime) return null;
  const byCampaign = {};
  let all = [];
  for (const r of rows) {
    if (!r.contactedAt) continue;
    const mins = (r.contactedAt - r.date) / 60000;
    if (!isFinite(mins) || mins < 0 || mins > 60 * 24 * 30) continue;   // ignore nonsense
    const c = bucket(r.campaign);
    (byCampaign[c] = byCampaign[c] || []).push(mins);
    all.push(mins);
  }
  if (all.length < 3) return null;
  const rowsOut = Object.keys(byCampaign)
    .map((c) => ({ campaign: c, median: median(byCampaign[c]), n: byCampaign[c].length }))
    .sort((a, b) => a.median - b.median);
  return { overall: median(all), n: all.length, rows: rowsOut };
}
function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function spendData(rows) {
  if (!state.spend.length) return null;
  const f = filters();
  const b = rangeBounds(f.range);
  const spendBy = {};
  for (const s of state.spend) {
    if (s.date) {
      if (b.from && s.date < b.from) continue;
      if (s.date >= b.to) continue;
    }
    if (f.campaign !== "__all__" && s.campaign !== f.campaign) continue;
    const c = bucket(s.campaign);
    spendBy[c] = (spendBy[c] || 0) + s.spend;
  }
  if (!Object.keys(spendBy).length) return null;

  const leadsBy = {}, revBy = {};
  for (const r of rows) {
    const c = bucket(r.campaign);
    leadsBy[c] = (leadsBy[c] || 0) + 1;
    if (r.closed && r.revenue) revBy[c] = (revBy[c] || 0) + r.revenue;
  }
  const out = Object.keys(spendBy).map((c) => ({
    campaign: c,
    spend: spendBy[c],
    leads: leadsBy[c] || 0,
    cpl: leadsBy[c] ? spendBy[c] / leadsBy[c] : null,
    revenue: revBy[c] || 0,
    roas: spendBy[c] > 0 ? (revBy[c] || 0) / spendBy[c] : null,
  }));
  return {
    rows: out,
    hasRevenue: out.some((r) => r.revenue > 0),
  };
}

/* ═══════════════════════════════════════════════════════════
   6. SVG chart primitives
   ═══════════════════════════════════════════════════════════ */

function el(tag, attrs, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function text(parent, x, y, str, cls, anchor) {
  const t = el("text", { x: x, y: y, class: cls || "axis-text", "text-anchor": anchor || "start" }, parent);
  t.textContent = str;                      // never innerHTML — labels are untrusted CSV
  return t;
}
function svgRoot(host, w, h) {
  host.textContent = "";
  const svg = el("svg", {
    viewBox: "0 0 " + w + " " + h,
    width: w, height: h,
    role: "img",
  }, host);
  return svg;
}
function hostWidth(host, min) {
  const w = host.clientWidth || host.parentElement.clientWidth || 600;
  return Math.max(min || 320, w);
}

/* Bar with a 4px rounded data-end, square at the baseline. */
function barPath(x, y, w, h, r, side) {
  r = Math.max(0, Math.min(r, side === "top" || side === "bottom" ? h : w, (side === "top" || side === "bottom" ? w : h) / 2));
  if (h <= 0 || w <= 0) return "";
  if (side === "top") {
    return "M" + x + "," + (y + h) + "V" + (y + r) +
           "a" + r + "," + r + " 0 0 1 " + r + ",-" + r +
           "H" + (x + w - r) +
           "a" + r + "," + r + " 0 0 1 " + r + "," + r +
           "V" + (y + h) + "Z";
  }
  if (side === "right") {
    return "M" + x + "," + y + "H" + (x + w - r) +
           "a" + r + "," + r + " 0 0 1 " + r + "," + r +
           "V" + (y + h - r) +
           "a" + r + "," + r + " 0 0 1 -" + r + "," + r +
           "H" + x + "Z";
  }
  if (side === "left") {
    return "M" + (x + w) + "," + y + "H" + (x + r) +
           "a" + r + "," + r + " 0 0 0 -" + r + "," + r +
           "V" + (y + h - r) +
           "a" + r + "," + r + " 0 0 0 " + r + "," + r +
           "H" + (x + w) + "Z";
  }
  return "M" + x + "," + y + "h" + w + "v" + h + "h" + -w + "Z";
}

/* Clean axis ticks: 0 / 5 / 10 … never 0 / 3.7 / 7.4 */
function niceTicks(max, target) {
  target = target || 5;
  if (!(max > 0)) return [0, 1];
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const out = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

function fmtInt(n) { return Math.round(n).toLocaleString("en-US"); }
function fmtNum(n, dp) {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: dp || 0, maximumFractionDigits: dp == null ? 1 : dp });
}
function fmtMoney(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000000) return "$" + fmtNum(n / 1000000, 1) + "M";
  if (abs >= 1000) return "$" + fmtNum(n / 1000, 1) + "K";
  return "$" + fmtNum(n, abs < 10 ? 2 : 0);
}
function fmtPct(p, dp) {
  if (p == null) return "—";
  const n = fmtNum(Math.abs(p) * 100, dp == null ? 0 : dp);
  // Match the true minus sign used by fmtSigned rather than a hyphen.
  return (p > 0 ? "+" : p < 0 ? "−" : "") + n + "%";
}
function fmtSigned(n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + fmtInt(Math.abs(n)); }
function fmtDuration(mins) {
  if (mins == null) return "—";
  if (mins < 60) return fmtNum(mins, 0) + " min";
  if (mins < 60 * 24) return fmtNum(mins / 60, 1) + " hr";
  return fmtNum(mins / 1440, 1) + " days";
}

/* ── Tooltip ─────────────────────────────────────────────── */
const tip = {
  node: null,
  show(html) {
    if (!this.node) this.node = document.getElementById("tooltip");
    this.node.textContent = "";
    this.node.appendChild(html);
    this.node.hidden = false;
  },
  move(ev) {
    if (!this.node || this.node.hidden) return;
    const pad = 14;
    const r = this.node.getBoundingClientRect();
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
    this.node.style.left = Math.max(8, x) + "px";
    this.node.style.top = Math.max(8, y) + "px";
  },
  hide() { if (this.node) this.node.hidden = true; },
};

/* Build a tooltip body. rows: [{color, name, value}] */
function tipBody(title, rows) {
  const frag = document.createDocumentFragment();
  const h = document.createElement("div");
  h.className = "tt-title";
  h.textContent = title;
  frag.appendChild(h);
  rows.forEach((r) => {
    const line = document.createElement("div");
    line.className = "tt-row";
    if (r.color) {
      const key = document.createElement("span");
      key.className = "tt-key";
      key.style.background = r.color;
      line.appendChild(key);
    }
    const v = document.createElement("span");
    v.className = "tt-val";
    v.textContent = r.value;                 // values lead
    line.appendChild(v);
    if (r.name) {
      const n = document.createElement("span");
      n.className = "tt-name";
      n.textContent = r.name;                // labels follow
      line.appendChild(n);
    }
    frag.appendChild(line);
  });
  return frag;
}

function attachTip(node, builder) {
  const enter = (ev) => { tip.show(builder()); tip.move(ev); };
  node.addEventListener("pointerenter", enter);
  node.addEventListener("pointermove", (ev) => tip.move(ev));
  node.addEventListener("pointerleave", () => tip.hide());
  node.addEventListener("focus", () => {
    tip.show(builder());
    const r = node.getBoundingClientRect();
    tip.move({ clientX: r.left + r.width / 2, clientY: r.top });
  });
  node.addEventListener("blur", () => tip.hide());
}

/* ── Legend (always present for ≥2 series) ──────────────── */
function legend(host, items) {
  const box = document.createElement("div");
  box.className = "legend";
  items.forEach((it) => {
    const span = document.createElement("span");
    span.className = "legend-item";
    const sw = document.createElement("span");
    sw.className = it.line ? "legend-line" : "legend-swatch";
    sw.style.background = it.color;
    span.appendChild(sw);
    const label = document.createElement("span");
    label.textContent = it.label;            // text keeps text tokens, never the series colour
    span.appendChild(label);
    box.appendChild(span);
  });
  host.appendChild(box);
}

function emptyState(host, title, body) {
  host.textContent = "";
  const d = document.createElement("div");
  d.className = "chart-empty";
  const strong = document.createElement("strong");
  strong.textContent = title;
  d.appendChild(strong);
  d.appendChild(document.createTextNode(body));
  host.appendChild(d);
}

/* ── Table view: every chart's accessible twin ───────────── */
function tableView(host, caption, columns, rows) {
  host.textContent = "";
  const table = document.createElement("table");
  const cap = document.createElement("caption");
  cap.textContent = caption;
  table.appendChild(cap);

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  columns.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c;
    th.scope = "col";
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    r.forEach((cell, i) => {
      const td = document.createElement(i === 0 ? "th" : "td");
      if (i === 0) td.scope = "row";
      if (cell && cell.nodeType) td.appendChild(cell);
      else td.textContent = cell == null ? "—" : String(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

/* A campaign name prefixed by its colour dot — identity never
   rests on the text colour. */
function keyCell(campaign) {
  const wrap = document.createElement("span");
  wrap.className = "cell-key";
  const dot = document.createElement("span");
  dot.className = "legend-swatch";
  dot.style.background = hueFor(campaign);
  wrap.appendChild(dot);
  wrap.appendChild(document.createTextNode(campaign));
  return wrap;
}
function chipCell(status) {
  const c = document.createElement("span");
  c.className = "chip";
  c.dataset.status = status.key;
  const ic = document.createElement("span");
  ic.className = "chip-icon";
  ic.textContent = status.icon;
  c.appendChild(ic);
  c.appendChild(document.createTextNode(status.label));
  return c;
}

/* ═══════════════════════════════════════════════════════════
   7. Chart renderers
   ═══════════════════════════════════════════════════════════ */

/* Sparkline — line + 10% wash + end dot with a surface ring. */
function renderSpark(host, series, h) {
  if (!series.length) { host.textContent = ""; return; }
  const w = hostWidth(host, 120);
  h = h || 60;
  const svg = svgRoot(host, w, h);
  const pad = 5;
  const max = Math.max(1, ...series.map((d) => d.value));
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(1, series.length - 1);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const color = cssVar("--series-1");

  let line = "", area = "";
  series.forEach((d, i) => {
    line += (i ? "L" : "M") + x(i).toFixed(1) + "," + y(d.value).toFixed(1);
  });
  area = line + "L" + x(series.length - 1).toFixed(1) + "," + (h - pad) +
         "L" + x(0).toFixed(1) + "," + (h - pad) + "Z";

  el("path", { d: area, fill: color, "fill-opacity": 0.1 }, svg);
  el("path", { d: line, fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
  const last = series[series.length - 1];
  el("circle", { cx: x(series.length - 1), cy: y(last.value), r: 4, fill: color, stroke: cssVar("--surface-1"), "stroke-width": 2 }, svg);
  svg.setAttribute("aria-label", "Trend sparkline, " + series.length + " days, latest " + last.value);
}

/* Daily columns + 7-day rolling average line. Two series → legend. */
function renderDaily(hostId, tableId, series) {
  const host = document.getElementById(hostId);
  const tableHost = document.getElementById(tableId);
  if (!series.length) {
    emptyState(host, "No leads in this range", "Widen the date range, or check the campaign filter.");
    tableHost.textContent = "";
    return;
  }

  const avg = rollingMean(series, 7);
  const colBar = cssVar("--series-1");
  const colLine = cssVar("--series-2");

  host.textContent = "";
  legend(host, [
    { color: colBar, label: "Leads per day" },
    { color: colLine, label: "7-day average", line: true },
  ]);

  const plotHost = document.createElement("div");
  host.appendChild(plotHost);

  const minW = Math.max(360, series.length * 11);
  const w = Math.max(hostWidth(host, 360), minW);
  const axisBand = 26;                       // reserved so x labels are never clipped
  const plotH = 220;
  const h = plotH + axisBand;
  const padL = 38, padR = 14, padT = 12;
  const svg = svgRoot(plotHost, w, h);
  svg.setAttribute("aria-label", "Leads per day with a 7-day rolling average");

  const innerW = w - padL - padR;
  const innerH = plotH - padT;
  const max = Math.max(1, ...series.map((d) => d.value));
  const ticks = niceTicks(max, 4);
  const top = ticks[ticks.length - 1];
  const y = (v) => padT + innerH - (v / top) * innerH;
  const band = innerW / series.length;
  const barW = Math.min(24, Math.max(2, band - 2));   // 2px surface gap between neighbours

  ticks.forEach((t) => {
    el("line", { x1: padL, x2: w - padR, y1: y(t), y2: y(t), class: t === 0 ? "baseline" : "gridline" }, svg);
    text(svg, padL - 8, y(t) + 4, fmtInt(t), "axis-text", "end");
  });

  series.forEach((d, i) => {
    const cx = padL + band * i + band / 2;
    if (d.value > 0) {
      el("path", {
        d: barPath(cx - barW / 2, y(d.value), barW, plotH - y(d.value), 4, "top"),
        fill: colBar, class: "mark",
      }, svg);
    }
  });

  let path = "";
  avg.forEach((d, i) => {
    const cx = padL + band * i + band / 2;
    path += (i ? "L" : "M") + cx.toFixed(1) + "," + y(d.value).toFixed(1);
  });
  el("path", { d: path, fill: "none", stroke: colLine, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);

  // Direct-label the final average value only — never every point.
  const lastAvg = avg[avg.length - 1];
  const lastX = padL + band * (avg.length - 1) + band / 2;
  el("circle", { cx: lastX, cy: y(lastAvg.value), r: 4, fill: colLine, stroke: cssVar("--surface-1"), "stroke-width": 2 }, svg);
  if (lastX < w - padR - 40) {
    text(svg, lastX + 8, y(lastAvg.value) - 7, fmtNum(lastAvg.value, 1) + "/day", "value-label", "start");
  } else {
    text(svg, lastX - 8, y(lastAvg.value) - 7, fmtNum(lastAvg.value, 1) + "/day", "value-label", "end");
  }

  // X labels: thin them out, and drop the final one if it would sit on top of
  // its neighbour (the classic "Aug 9Aug 10" collision at the right edge).
  const every = Math.max(1, Math.ceil(series.length / Math.max(1, Math.floor(innerW / 62))));
  const LABEL_W = 46;
  let lastLabelX = -Infinity;
  series.forEach((d, i) => {
    const isLast = i === series.length - 1;
    if (i % every !== 0 && !isLast) return;
    const cx = padL + band * i + band / 2;
    if (cx - lastLabelX < LABEL_W) {
      if (!isLast) return;
      // The final tick is the useful one — remove whatever it would overlap.
      const prev = svg.querySelector("text[data-xtick=\"" + lastLabelX + "\"]");
      if (prev) prev.remove();
    }
    const t = text(svg, cx, plotH + 18, shortDay(d.key), "axis-text", "middle");
    t.setAttribute("data-xtick", cx);
    lastLabelX = cx;
  });

  // Crosshair finds the X; one tooltip lists both series.
  const cross = el("line", { y1: padT, y2: plotH, class: "crosshair", opacity: 0 }, svg);
  const zone = el("rect", { x: padL, y: padT, width: innerW, height: plotH - padT, class: "hitzone" }, svg);
  zone.addEventListener("pointermove", (ev) => {
    const rect = svg.getBoundingClientRect();
    const rel = ((ev.clientX - rect.left) / rect.width) * w;
    let i = Math.round((rel - padL - band / 2) / band);
    i = Math.max(0, Math.min(series.length - 1, i));
    const cx = padL + band * i + band / 2;
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("opacity", 1);
    tip.show(tipBody(shortDay(series[i].key), [
      { color: colBar, value: fmtInt(series[i].value), name: series[i].value === 1 ? "lead" : "leads" },
      { color: colLine, value: fmtNum(avg[i].value, 1), name: "7-day avg" },
    ]));
    tip.move(ev);
  });
  zone.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); tip.hide(); });

  tableView(tableHost, "Leads per day", ["Day", "Leads", "7-day avg"],
    series.map((d, i) => [shortDay(d.key), fmtInt(d.value), fmtNum(avg[i].value, 1)]));
}

/* Diverging bars: change in leads by campaign. Polarity, not identity —
   so blue/red poles with a neutral zero rule, not the categorical set. */
function renderDip(analysis) {
  const host = document.getElementById("dipChart");
  const tableHost = document.getElementById("dipTable");
  const note = document.getElementById("dipChartNote");

  if (!analysis || !analysis.prior) {
    emptyState(host, "Not enough history yet",
      "A week-over-week comparison needs at least two weeks of leads. " +
      "Backfill older weeks by pasting an InvestorFuse export into the sheet.");
    tableHost.textContent = "";
    note.textContent = "";
    return;
  }

  const rows = analysis.rows;
  note.textContent = analysis.partial
    ? "Comparing the first " + analysis.elapsed + (analysis.elapsed === 1 ? " day" : " days") +
      " of " + weekLabel(analysis.focus) + " against the same days of " + weekLabel(analysis.prior) + "."
    : weekLabel(analysis.focus) + " (" + weekRangeLabel(analysis.focus) + ") vs " +
      weekLabel(analysis.prior) + " (" + weekRangeLabel(analysis.prior) + ").";

  host.textContent = "";
  const up = cssVar("--div-up"), down = cssVar("--div-down");
  legend(host, [{ color: down, label: "Fewer leads" }, { color: up, label: "More leads" }]);

  const plotHost = document.createElement("div");
  host.appendChild(plotHost);

  const w = hostWidth(host, 360);
  const rowH = 34;
  const padT = 10, padB = 26;
  const h = rows.length * rowH + padT + padB;
  const labelW = Math.min(190, Math.max(110, Math.round(w * 0.28)));
  const valueW = 52;
  const svg = svgRoot(plotHost, w, h);
  svg.setAttribute("aria-label", "Change in leads by campaign, week over week");

  const plotL = labelW + 10;
  const plotW = w - plotL - valueW - 10;
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.delta)));
  const zero = plotL + plotW / 2;
  const scale = (plotW / 2) / maxAbs;
  const barH = Math.min(24, rowH - 10);

  // neutral zero rule
  el("line", { x1: zero, x2: zero, y1: padT, y2: h - padB, class: "baseline" }, svg);

  rows.forEach((r, i) => {
    const cy = padT + i * rowH + rowH / 2;
    const len = Math.abs(r.delta) * scale;
    const isDown = r.delta < 0;

    // Campaign label with its own colour dot, so identity survives greyscale.
    el("circle", { cx: 6, cy: cy, r: 4.5, fill: hueFor(r.campaign) }, svg);
    const label = truncate(r.campaign, Math.floor((labelW - 18) / 6.4));
    text(svg, 17, cy + 4, label, "axis-text-cat", "start");

    if (r.delta !== 0) {
      const x = isDown ? zero - len : zero;
      el("path", {
        d: barPath(x, cy - barH / 2, len, barH, 4, isDown ? "left" : "right"),
        fill: isDown ? down : up, class: "mark",
      }, svg);
    } else {
      el("circle", { cx: zero, cy: cy, r: 3, fill: cssVar("--text-muted") }, svg);
    }

    // Value at the tip, outside the bar — never clipped inside it.
    const vx = isDown ? zero - len - 8 : zero + len + 8;
    text(svg, vx, cy + 4, fmtSigned(r.delta), "value-label-strong", isDown ? "end" : "start");

    const hit = el("rect", {
      x: 0, y: padT + i * rowH, width: w, height: rowH, class: "hitzone",
    }, svg);
    hit.setAttribute("tabindex", "0");
    attachTip(hit, () => tipBody(r.campaign, [
      { color: hueFor(r.campaign), value: fmtSigned(r.delta) + " leads", name: "change" },
      { value: fmtInt(r.before) + " → " + fmtInt(r.now), name: "prior → this week" },
      { value: r.pct == null ? "new" : fmtPct(r.pct), name: "change %" },
      r.shareOfDecline != null
        ? { value: fmtNum(r.shareOfDecline * 100, 0) + "%", name: "of the total decline" }
        : null,
      r.trailingAvg != null
        ? { value: fmtNum(r.trailingAvg, 1), name: "its 4-week average" }
        : null,
    ].filter(Boolean)));
  });

  text(svg, plotL, h - 8, "fewer", "axis-text", "start");
  text(svg, w - valueW - 10, h - 8, "more", "axis-text", "end");

  tableView(tableHost,
    "Change in leads by campaign — " + weekLabel(analysis.focus) + " vs " + weekLabel(analysis.prior),
    ["Campaign", weekLabel(analysis.prior), weekLabel(analysis.focus), "Change", "Change %", "Share of decline", "4-wk avg", "Read"],
    rows.map((r) => [
      keyCell(r.campaign),
      fmtInt(r.before),
      fmtInt(r.now),
      fmtSigned(r.delta),
      r.pct == null ? "new" : fmtPct(r.pct),
      r.shareOfDecline == null ? "—" : fmtNum(r.shareOfDecline * 100, 0) + "%",
      r.trailingAvg == null ? "—" : fmtNum(r.trailingAvg, 1),
      chipCell(r.status),
    ]));
}

/* Stacked columns: weekly leads split by campaign. */
function renderWeekly(rows) {
  const host = document.getElementById("weeklyChart");
  const tableHost = document.getElementById("weeklyTable");
  const wk = weeklyByCampaign(rows);

  if (!wk.weeks.length) {
    emptyState(host, "No weeks to show", "Widen the date range to see weekly totals.");
    tableHost.textContent = "";
    return;
  }

  host.textContent = "";
  legend(host, wk.campaigns.map((c) => ({ color: hueFor(c), label: c })));
  const plotHost = document.createElement("div");
  host.appendChild(plotHost);

  const minW = Math.max(380, wk.weeks.length * 54);
  const w = Math.max(hostWidth(host, 380), minW);
  const axisBand = 30;
  const plotH = 250;
  const h = plotH + axisBand;
  const padL = 38, padR = 14, padT = 14;
  const svg = svgRoot(plotHost, w, h);
  svg.setAttribute("aria-label", "Weekly leads by campaign, stacked");

  const innerW = w - padL - padR;
  const thisWeek = weekKey(new Date());
  const totals = wk.weeks.map((k) => wk.campaigns.reduce((s, c) => s + (wk.data[k][c] || 0), 0));
  const ticks = niceTicks(Math.max(1, ...totals), 4);
  const top = ticks[ticks.length - 1];
  const y = (v) => padT + (plotH - padT) - (v / top) * (plotH - padT);
  const band = innerW / wk.weeks.length;
  const barW = Math.min(24, Math.max(6, band - 14));
  const GAP = 2;                               // surface gap between segments

  ticks.forEach((t) => {
    el("line", { x1: padL, x2: w - padR, y1: y(t), y2: y(t), class: t === 0 ? "baseline" : "gridline" }, svg);
    text(svg, padL - 8, y(t) + 4, fmtInt(t), "axis-text", "end");
  });

  wk.weeks.forEach((key, i) => {
    const cx = padL + band * i + band / 2;
    let acc = 0;
    const stackRows = [];
    wk.campaigns.forEach((c) => {
      const v = wk.data[key][c] || 0;
      if (!v) return;
      stackRows.push({ campaign: c, value: v });
    });

    // Draw bottom-up; the topmost segment gets the rounded data-end.
    // Non-top segments give up 2px off their top edge — that surface gap is
    // what separates them, rather than a stroke drawn around each one.
    stackRows.forEach((seg, si) => {
      const y0 = y(acc), y1 = y(acc + seg.value);
      const isTop = si === stackRows.length - 1;
      const segTop = isTop ? y1 : y1 + GAP;
      const segH = isTop ? y0 - y1 : Math.max(0, y0 - y1 - GAP);
      if (segH > 0) {
        el("path", {
          d: barPath(cx - barW / 2, segTop, barW, segH, isTop ? 4 : 0, isTop ? "top" : "flat"),
          fill: hueFor(seg.campaign), class: "mark",
        }, svg);
      }
      acc += seg.value;
    });

    if (totals[i] > 0) {
      text(svg, cx, y(totals[i]) - 8, fmtInt(totals[i]), "value-label", "middle");
    }
    const running = key === thisWeek;
    text(svg, cx, plotH + 16, weekLabel(key), "axis-text", "middle");
    text(svg, cx, plotH + 27, running ? "in progress" : weekRangeLabel(key), "axis-text", "middle");

    const hit = el("rect", { x: padL + band * i, y: padT, width: band, height: plotH - padT, class: "hitzone" }, svg);
    hit.setAttribute("tabindex", "0");
    attachTip(hit, () => tipBody(weekLabel(key) + " · " + weekRangeLabel(key) +
      (running ? " (still running)" : ""),
      [{ value: fmtInt(totals[i]), name: "leads total" }].concat(
        stackRows.slice().reverse().map((s) => ({
          color: hueFor(s.campaign), value: fmtInt(s.value), name: s.campaign,
        }))
      )));
  });

  tableView(tableHost, "Weekly leads by campaign (whole Sun–Sat weeks)",
    ["Week"].concat(wk.campaigns, ["Total"]),
    wk.weeks.map((k, i) => [
      weekLabel(k) + " (" + weekRangeLabel(k) + (k === thisWeek ? ", in progress" : "") + ")",
    ].concat(wk.campaigns.map((c) => fmtInt(wk.data[k][c] || 0)), [fmtInt(totals[i])])));
}

/* Horizontal bars, one hue — magnitude ranking. */
function renderHBars(opts) {
  const host = document.getElementById(opts.hostId);
  const tableHost = document.getElementById(opts.tableId);
  const rows = opts.rows;

  if (!rows || !rows.length) {
    emptyState(host, opts.emptyTitle, opts.emptyBody);
    tableHost.textContent = "";
    return;
  }

  host.textContent = "";
  const w = hostWidth(host, 320);
  const rowH = 32;
  const padT = 6, padB = 6;
  const h = rows.length * rowH + padT + padB;
  const labelW = Math.min(180, Math.max(96, Math.round(w * 0.32)));
  const valueW = opts.valueW || 62;
  const svg = svgRoot(host, w, h);
  svg.setAttribute("aria-label", opts.aria || opts.caption);

  const plotL = labelW + 10;
  const plotW = Math.max(40, w - plotL - valueW - 8);
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  const barH = Math.min(24, rowH - 10);

  rows.forEach((r, i) => {
    const cy = padT + i * rowH + rowH / 2;
    const len = Math.max(r.value > 0 ? 2 : 0, (r.value / max) * plotW);
    const color = opts.colorFor ? opts.colorFor(r, i) : cssVar("--series-1");

    if (opts.dotKey !== false) {
      el("circle", { cx: 6, cy: cy, r: 4.5, fill: hueFor(r.label) }, svg);
    }
    text(svg, opts.dotKey === false ? 2 : 17, cy + 4,
      truncate(r.label, Math.floor((labelW - 22) / 6.4)), "axis-text-cat", "start");

    if (len > 0) {
      el("path", { d: barPath(plotL, cy - barH / 2, len, barH, 4, "right"), fill: color, class: "mark" }, svg);
    }
    // Value sits outside the bar end, so it can never be clipped by a short bar.
    text(svg, plotL + len + 8, cy + 4, r.display, "value-label-strong", "start");

    const hit = el("rect", { x: 0, y: padT + i * rowH, width: w, height: rowH, class: "hitzone" }, svg);
    hit.setAttribute("tabindex", "0");
    attachTip(hit, () => tipBody(r.label, r.tip || [{ color: color, value: r.display, name: opts.unit || "" }]));
  });

  tableView(tableHost, opts.caption, opts.columns,
    rows.map((r) => (opts.tableRow ? opts.tableRow(r) : [keyCell(r.label), r.display])));
}

/* Funnel — an ordered scale, so the ordinal one-hue ramp. */
function renderFunnel(rows) {
  const host = document.getElementById("funnelChart");
  const tableHost = document.getElementById("funnelTable");
  const note = document.getElementById("funnelNote");
  const data = funnelData(rows);

  if (!data) {
    note.textContent = "";
    emptyState(host, "No funnel columns yet",
      "Add a Date Qualified, Appointment, Offer, Contract or Closing column to the sheet and this fills in automatically.");
    tableHost.textContent = "";
    return;
  }

  const stages = data.bars;
  const all = data.all;
  const top = all[0].count || 1;
  const last = all[all.length - 1];
  note.textContent = "Of " + fmtInt(top) + " leads created in this range, " +
    fmtNum((last.count / top) * 100, 1) + "% have reached " + last.label.toLowerCase() +
    (all.length > stages.length ? ". Later stages are in the data table below." : ".") +
    // This funnel follows a cohort, so a short range holds leads that simply
    // have not had time to close yet — worth saying before someone reads a
    // low closing rate as a performance problem.
    " These are the same leads followed forward, so a short range shows deals " +
    "that have not had time to close yet.";

  const ramp = ordinalColors();
  host.textContent = "";
  const w = hostWidth(host, 300);
  const rowH = 44;
  const h = stages.length * rowH + 10;
  const labelW = Math.min(120, Math.max(88, Math.round(w * 0.26)));
  const svg = svgRoot(host, w, h);
  svg.setAttribute("aria-label", "Funnel conversion by stage");

  const plotL = labelW + 8;
  const plotW = Math.max(40, w - plotL - 74);
  const barH = 22;

  stages.forEach((s, i) => {
    const cy = 8 + i * rowH + barH / 2;
    const len = Math.max(s.count > 0 ? 2 : 0, (s.count / top) * plotW);
    text(svg, 2, cy + 4, s.label, "axis-text-cat", "start");
    if (len > 0) {
      el("path", { d: barPath(plotL, cy - barH / 2, len, barH, 4, "right"), fill: ramp[i], class: "mark" }, svg);
    }
    text(svg, plotL + len + 8, cy + 4, fmtInt(s.count), "value-label-strong", "start");

    // step-to-step conversion, between the rows
    if (i > 0) {
      const prev = stages[i - 1].count;
      const rate = prev > 0 ? s.count / prev : null;
      text(svg, plotL, cy - barH / 2 - 8,
        rate == null ? "—" : fmtNum(rate * 100, 1) + "% from " + stages[i - 1].label.toLowerCase(),
        "axis-text", "start");
    }

    const hit = el("rect", { x: 0, y: 8 + i * rowH - 6, width: w, height: rowH, class: "hitzone" }, svg);
    hit.setAttribute("tabindex", "0");
    attachTip(hit, () => tipBody(s.label, [
      { color: ramp[i], value: fmtInt(s.count), name: "leads" },
      { value: fmtNum((s.count / top) * 100, 1) + "%", name: "of all leads" },
    ]));
  });

  tableView(tableHost, "Funnel conversion", ["Stage", "Leads", "% of leads", "Step conversion"],
    all.map((s, i) => [
      s.label,
      fmtInt(s.count),
      fmtNum((s.count / top) * 100, 1) + "%",
      i === 0 ? "—" : (all[i - 1].count > 0 ? fmtNum((s.count / all[i - 1].count) * 100, 1) + "%" : "—"),
    ]));
}

function renderSpeed(rows) {
  const note = document.getElementById("speedNote");
  const data = speedData(rows);

  if (!data) {
    note.textContent = "";
    renderHBars({
      hostId: "speedChart", tableId: "speedTable", rows: [],
      emptyTitle: "No first-contact timestamps yet",
      emptyBody: "Add a \"First Contact\" column (a full date and time) to the sheet, " +
                 "and make sure the lead date carries a time too.",
    });
    return;
  }

  note.textContent = "Median " + fmtDuration(data.overall) + " to first contact, across " +
    fmtInt(data.n) + " leads.";

  renderHBars({
    hostId: "speedChart", tableId: "speedTable",
    caption: "Median time to first contact by campaign",
    aria: "Median time to first contact by campaign",
    columns: ["Campaign", "Median time to contact", "Leads measured"],
    unit: "median to first contact",
    rows: data.rows.map((r) => ({
      label: r.campaign,
      value: r.median,
      display: fmtDuration(r.median),
      tip: [
        { color: hueFor(r.campaign), value: fmtDuration(r.median), name: "median to first contact" },
        { value: fmtInt(r.n), name: "leads measured" },
      ],
    })),
    tableRow: (r) => [keyCell(r.label), r.display, fmtInt(
      data.rows.filter((x) => x.campaign === r.label)[0].n
    )],
  });
}

function renderSpendCharts(rows) {
  const data = spendData(rows);
  const cplNote = document.getElementById("cplNote");
  const roasNote = document.getElementById("roasNote");

  if (!data) {
    cplNote.textContent = "";
    roasNote.textContent = "";
    renderHBars({
      hostId: "cplChart", tableId: "cplTable", rows: [],
      emptyTitle: "No ad spend connected",
      emptyBody: "Add a spend sheet (Date, Campaign, Spend) under ⚙ Data source and cost per lead appears here.",
    });
    renderHBars({
      hostId: "roasChart", tableId: "roasTable", rows: [],
      emptyTitle: "No ad spend connected",
      emptyBody: "ROAS needs both a spend sheet and a revenue column on closed deals.",
    });
    return;
  }

  const totalSpend = data.rows.reduce((s, r) => s + r.spend, 0);
  const totalLeads = data.rows.reduce((s, r) => s + r.leads, 0);
  cplNote.textContent = fmtMoney(totalSpend) + " spent · " + fmtInt(totalLeads) + " leads · blended " +
    fmtMoney(totalLeads ? totalSpend / totalLeads : null) + " per lead.";

  const cplRows = data.rows.filter((r) => r.cpl != null).sort((a, b) => a.cpl - b.cpl);
  renderHBars({
    hostId: "cplChart", tableId: "cplTable",
    caption: "Cost per lead by campaign",
    aria: "Cost per lead by campaign",
    columns: ["Campaign", "Spend", "Leads", "Cost per lead"],
    rows: cplRows.map((r) => ({
      label: r.campaign, value: r.cpl, display: fmtMoney(r.cpl),
      tip: [
        { color: hueFor(r.campaign), value: fmtMoney(r.cpl), name: "per lead" },
        { value: fmtMoney(r.spend), name: "spend" },
        { value: fmtInt(r.leads), name: "leads" },
      ],
    })),
    tableRow: (r) => {
      const src = cplRows.filter((x) => x.campaign === r.label)[0];
      return [keyCell(r.label), fmtMoney(src.spend), fmtInt(src.leads), fmtMoney(src.cpl)];
    },
  });

  if (!data.hasRevenue) {
    roasNote.textContent = "";
    renderHBars({
      hostId: "roasChart", tableId: "roasTable", rows: [],
      emptyTitle: "No revenue on closed deals yet",
      emptyBody: "Add a Revenue (or Net Profit) column filled in on closed leads, and ROAS calculates itself.",
    });
    return;
  }

  const totalRev = data.rows.reduce((s, r) => s + r.revenue, 0);
  roasNote.textContent = "Blended " + fmtNum(totalSpend ? totalRev / totalSpend : 0, 2) +
    "× return on " + fmtMoney(totalSpend) + " of spend.";

  const roasRows = data.rows.filter((r) => r.roas != null).sort((a, b) => b.roas - a.roas);
  renderHBars({
    hostId: "roasChart", tableId: "roasTable",
    caption: "Return on ad spend by campaign",
    aria: "Return on ad spend by campaign",
    columns: ["Campaign", "Spend", "Revenue", "ROAS"],
    rows: roasRows.map((r) => ({
      label: r.campaign, value: r.roas, display: fmtNum(r.roas, 2) + "×",
      tip: [
        { color: hueFor(r.campaign), value: fmtNum(r.roas, 2) + "×", name: "return on spend" },
        { value: fmtMoney(r.revenue), name: "revenue" },
        { value: fmtMoney(r.spend), name: "spend" },
      ],
    })),
    tableRow: (r) => {
      const src = roasRows.filter((x) => x.campaign === r.label)[0];
      return [keyCell(r.label), fmtMoney(src.spend), fmtMoney(src.revenue), fmtNum(src.roas, 2) + "×"];
    },
  });
}

function truncate(s, max) {
  s = String(s);
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + "…" : s;
}

/* ═══════════════════════════════════════════════════════════
   8. KPI tiles, verdict copy, page render
   ═══════════════════════════════════════════════════════════ */

function deltaSpan(delta, opts) {
  const span = document.createElement("span");
  const goodWhenUp = !opts || opts.goodWhenUp !== false;
  const cls = delta === 0 ? "delta-flat" : (delta > 0) === goodWhenUp ? "delta-good" : "delta-bad";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  const strong = document.createElement("span");
  strong.className = cls;
  strong.textContent = arrow + " " + (opts && opts.fmt ? opts.fmt(delta) : fmtSigned(delta));
  span.appendChild(strong);
  if (opts && opts.vs) {
    span.appendChild(document.createTextNode(" " + opts.vs));
  }
  return span;
}

function renderKpis(rows, series, analysis) {
  const host = document.getElementById("kpiRow");
  host.textContent = "";

  const today = dayKey(new Date());
  const yday = dayKey(addDays(new Date(), -1));
  const byDay = countBy(state.rows, (r) => r.day);
  const f = filters();
  const scoped = f.campaign === "__all__" ? byDay : countBy(rows, (r) => r.day);

  const last7 = series.slice(-7).reduce((s, d) => s + d.value, 0);
  const prev7 = series.slice(-14, -7).reduce((s, d) => s + d.value, 0);
  const avg7 = series.length ? last7 / Math.min(7, series.length) : 0;

  const tiles = [
    {
      label: "Leads yesterday",
      value: fmtInt(scoped[yday] || 0),
      delta: deltaSpan((scoped[yday] || 0) - (scoped[dayKey(addDays(new Date(), -2))] || 0),
        { vs: "vs the day before" }),
      spark: series.slice(-14),
    },
    {
      label: "Last 7 days",
      value: fmtInt(last7),
      delta: deltaSpan(last7 - prev7, { vs: "vs the 7 days before" }),
      spark: series.slice(-14),
    },
    {
      label: "Average per day",
      value: fmtNum(avg7, 1),
      delta: null,
      sub: "over the last " + Math.min(7, series.length) + " days",
      spark: null,
    },
    {
      label: "Leads in range",
      value: fmtInt(rows.length),
      delta: null,
      sub: rangeText(),
      spark: null,
    },
  ];

  if (analysis && analysis.prior) {
    tiles.push({
      label: weekLabel(analysis.focus) + (analysis.partial ? " so far" : ""),
      value: fmtInt(analysis.totalNow),
      delta: deltaSpan(analysis.totalDelta, { vs: "vs " + weekLabel(analysis.prior) }),
      spark: null,
    });
  }

  // Build and append every tile FIRST. The grid is auto-fit, so a tile measured
  // while it is the only child reports the full row width — sparklines have to
  // wait until all the columns exist.
  const pending = [];
  tiles.forEach((t) => {
    const card = document.createElement("div");
    card.className = "kpi";
    const l = document.createElement("div");
    l.className = "kpi-label";
    l.textContent = t.label;
    const v = document.createElement("div");
    v.className = "kpi-value";
    v.textContent = t.value;
    card.appendChild(l);
    card.appendChild(v);
    if (t.delta) {
      const d = document.createElement("div");
      d.className = "kpi-delta";
      d.appendChild(t.delta);
      card.appendChild(d);
    } else if (t.sub) {
      const d = document.createElement("div");
      d.className = "kpi-delta";
      d.textContent = t.sub;
      card.appendChild(d);
    }
    if (t.spark && t.spark.length > 1) {
      const s = document.createElement("div");
      s.className = "kpi-spark";
      card.appendChild(s);
      pending.push({ host: s, series: t.spark });
    }
    host.appendChild(card);
  });
  pending.forEach((p) => renderSpark(p.host, p.series, 30));
}

/* "A", "A and B", "A, B and C" */
function list(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return items[0] + " and " + items[1];
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

function rangeText() {
  const f = filters();
  if (f.range === "all") return "all time";
  if (f.range === "mtd") return "month to date";
  return "last " + f.range + " days";
}

/* The sentence someone reads out loud in the meeting. */
function renderVerdict(analysis) {
  const card = document.getElementById("verdictCard");
  const line = document.getElementById("verdict");
  const sub = document.getElementById("verdictSub");

  if (!analysis || !analysis.prior) {
    card.dataset.tone = "flat";
    line.textContent = "Waiting on a second week of data.";
    sub.textContent = "Once two weeks are in the sheet, this reads out which campaign moved the number.";
    return;
  }

  const wkNow = weekLabel(analysis.focus);
  const wkPrev = weekLabel(analysis.prior);
  const scope = analysis.partial
    ? wkNow + " so far (first " + analysis.elapsed + (analysis.elapsed === 1 ? " day" : " days") + ")"
    : wkNow;
  const d = analysis.totalDelta;
  const decliners = analysis.rows.filter((r) => r.delta < 0);

  if (d === 0) {
    card.dataset.tone = "flat";
    line.textContent = scope + " is flat against " + wkPrev + " at " + fmtInt(analysis.totalNow) + " leads.";
  } else if (d > 0) {
    card.dataset.tone = "up";
    const top = analysis.rows.slice().sort((a, b) => b.delta - a.delta)[0];
    line.textContent = "Leads are up " + fmtInt(d) +
      (analysis.totalPct == null ? "" : " (" + fmtPct(analysis.totalPct) + ")") +
      " in " + scope + " vs " + wkPrev + " — " + top.campaign + " led the gain with " +
      fmtSigned(top.delta) + ".";
  } else {
    card.dataset.tone = "down";
    const worst = decliners[0];
    let s = "Leads are down " + fmtInt(-d) +
      (analysis.totalPct == null ? "" : " (" + fmtPct(analysis.totalPct) + ")") +
      " in " + scope + " vs " + wkPrev + ".";
    if (worst) {
      s += " " + worst.campaign + " is the biggest driver: " + fmtInt(worst.before) + " → " +
        fmtInt(worst.now) + " (" + fmtSigned(worst.delta) + ")";
      if (worst.shareOfDecline != null) {
        s += ", " + fmtNum(worst.shareOfDecline * 100, 0) + "% of the drop";
      }
      s += ".";
    }
    line.textContent = s;
  }

  // Supporting detail: the rest of the decline, and anything that went quiet.
  const bits = [];
  if (decliners.length > 1) {
    const named = decliners.slice(1, 4).map((r) => r.campaign + " (" + fmtSigned(r.delta) + ")");
    if (decliners.length > 4) named.push((decliners.length - 4) + " more");
    bits.push("Also down: " + list(named) + ".");
  }
  const quiet = analysis.rows.filter((r) => r.before > 0 && r.now === 0);
  if (quiet.length) {
    bits.push(list(quiet.map((r) => r.campaign)) +
      (quiet.length === 1 ? " produced" : " produced") + " no leads at all this week — " +
      (quiet.length === 1 ? "worth checking that campaign is still live." : "worth checking those campaigns are still live."));
  }
  const belowNorm = analysis.rows.filter((r) => r.vsTrailing != null && r.vsTrailing <= -0.25 && r.delta < 0);
  if (belowNorm.length) {
    bits.push(list(belowNorm.map((r) => r.campaign)) +
      (belowNorm.length === 1 ? " also sits" : " also sit") +
      " more than 25% below " + (belowNorm.length === 1 ? "its" : "their") +
      " own 4-week average, so this is not just a normal quiet week.");
  }
  if (analysis.partial) {
    bits.push("This week is still running, so it is compared against the same first " +
      analysis.elapsed + (analysis.elapsed === 1 ? " day" : " days") + " of " + wkPrev + ".");
  }
  sub.textContent = bits.join(" ");
}

function render() {
  const f = filters();
  document.getElementById("main").classList.toggle("tables-on", f.tables);

  renderNotice();
  updateLivePill();

  const rows = slice();
  const series = dailySeries(rows);
  const analysis = state.rows.length ? dipAnalysis(f.week) : null;

  // Hero
  const todayCount = countBy(rows, (r) => r.day)[dayKey(new Date())] || 0;
  document.getElementById("heroToday").textContent = fmtInt(todayCount);
  const ydayCount = countBy(rows, (r) => r.day)[dayKey(addDays(new Date(), -1))] || 0;
  const heroDelta = document.getElementById("heroDelta");
  heroDelta.textContent = "";
  if (state.rows.length) {
    heroDelta.appendChild(deltaSpan(todayCount - ydayCount, { vs: "vs yesterday · today is still counting" }));
  }
  document.getElementById("pulseRange").textContent =
    state.rows.length
      ? "Showing " + rangeText() + (f.campaign === "__all__" ? " across all campaigns" : " for " + f.campaign) + "."
      : "";
  renderSpark(document.getElementById("heroSpark"), series.slice(-30), 66);

  renderKpis(rows, series, analysis);
  renderScorecard();
  renderVerdict(analysis);
  renderDip(analysis);
  renderDaily("dailyChart", "dailyTable", series);
  renderWeekly(rows);

  const board = countBy(rows, (r) => bucket(r.campaign));
  // "Other" is a bucket, not a campaign — say what is inside it rather than
  // leaving a big unexplained bar on a slide.
  const otherParts = countBy(rows.filter((r) => bucket(r.campaign) === "Other"),
    (r) => r.campaign);
  const boardRows = Object.keys(board)
    .sort((a, b) => board[b] - board[a] || a.localeCompare(b))
    .map((c) => ({
      label: c, value: board[c], display: fmtInt(board[c]),
      tip: [
        { color: hueFor(c), value: fmtInt(board[c]), name: "leads" },
        { value: fmtNum((board[c] / Math.max(1, rows.length)) * 100, 1) + "%", name: "of all leads in range" },
      ].concat(c !== "Other" ? [] :
        Object.keys(otherParts)
          .sort((a, b) => otherParts[b] - otherParts[a] || a.localeCompare(b))
          .slice(0, 8)
          .map((n) => ({ value: fmtInt(otherParts[n]), name: n }))),
    }));
  renderHBars({
    hostId: "boardChart", tableId: "boardTable",
    caption: "Total leads by campaign — " + rangeText(),
    aria: "Total leads by campaign",
    columns: ["Campaign", "Leads", "Share"],
    rows: boardRows,
    tableRow: (r) => [keyCell(r.label), r.display,
      fmtNum((r.value / Math.max(1, rows.length)) * 100, 1) + "%"],
  });

  renderFunnel(rows);
  renderSpeed(rows);
  renderSpendCharts(rows);

  // Table views follow the one global toggle.
  ["dipTable", "dailyTable", "weeklyTable", "boardTable", "funnelTable", "speedTable", "cplTable", "roasTable"]
    .forEach((id) => { document.getElementById(id).hidden = !f.tables; });

  const foot = document.getElementById("footStatus");
  const mergedCount = Object.keys(state.mergedNames || {}).length;
  foot.textContent = state.rows.length
    ? fmtInt(state.rows.length) + " leads loaded · " +
      state.campaignList.length + " campaigns with a colour" +
      (state.otherCampaigns && state.otherCampaigns.length
        ? " · " + state.otherCampaigns.length + " folded into “Other”" : "") +
      (mergedCount ? " · " + mergedCount + " duplicate campaign names merged" : "")
    : "";
}

function renderNotice() {
  const n = document.getElementById("notice");
  n.textContent = "";

  if (state.fetchError) {
    n.hidden = false;
    n.dataset.tone = "error";
    const b = document.createElement("strong");
    b.textContent = "Could not load the sheet. ";
    n.appendChild(b);
    n.appendChild(document.createTextNode(state.fetchError));
    return;
  }
  if (state.source === "none") {
    n.hidden = false;
    n.dataset.tone = "warn";
    const b = document.createElement("strong");
    b.textContent = "No data source connected yet. ";
    n.appendChild(b);
    n.appendChild(document.createTextNode(
      "Open ⚙ Data source to paste your published Google Sheet link, or load the sample data to see how the dashboard reads."));
    return;
  }
  if (state.source === "seed") {
    n.hidden = false;
    n.dataset.tone = "warn";
    const b = document.createElement("strong");
    b.textContent = "Reading the committed CRM history. ";
    n.appendChild(b);
    n.appendChild(document.createTextNode(
      "These are your real InvestorFuse leads through the export date, so nothing after it is here. " +
      "Connect the live sheet under ⚙ Data source to keep it current."));
    return;
  }
  if (state.source === "demo") {
    n.hidden = false;
    n.dataset.tone = "";
    const b = document.createElement("strong");
    b.textContent = "Sample data. ";
    n.appendChild(b);
    n.appendChild(document.createTextNode(
      "These numbers are invented so you can see the layout — connect your sheet under ⚙ Data source to go live."));
    return;
  }
  n.hidden = true;
}

function updateLivePill() {
  const pill = document.getElementById("livePill");
  const txt = document.getElementById("liveText");

  if (state.fetchError) {
    pill.dataset.state = "error";
    txt.textContent = "Connection problem";
    return;
  }
  if (state.source === "demo") {
    pill.dataset.state = "demo";
    txt.textContent = "Sample data";
    return;
  }
  if (state.source === "none") {
    pill.dataset.state = "";
    txt.textContent = "Not connected";
    return;
  }
  if (state.source === "paste") {
    pill.dataset.state = "stale";
    txt.textContent = "Pasted CSV (not live)";
    return;
  }
  if (state.source === "seed") {
    pill.dataset.state = "stale";
    txt.textContent = "CRM history (not live)";
    return;
  }
  const secs = state.lastFetch ? Math.round((Date.now() - state.lastFetch) / 1000) : null;
  pill.dataset.state = secs != null && secs < 180 ? "live" : "stale";
  txt.textContent = secs == null ? "Connected"
    : secs < 10 ? "Live · just updated"
    : secs < 90 ? "Live · " + secs + "s ago"
    : "Updated " + Math.round(secs / 60) + " min ago";
}

/* ═══════════════════════════════════════════════════════════
   9. Filter option lists
   ═══════════════════════════════════════════════════════════ */

function buildCampaignOptions() {
  const sel = document.getElementById("fltCampaign");
  const current = sel.value;
  const totals = {};
  for (const r of state.rows) totals[r.campaign] = (totals[r.campaign] || 0) + 1;
  const names = Object.keys(totals).sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));

  sel.textContent = "";
  const all = document.createElement("option");
  all.value = "__all__";
  all.textContent = "All campaigns";
  sel.appendChild(all);
  names.forEach((n) => {
    const o = document.createElement("option");
    o.value = n;
    o.textContent = n + " (" + totals[n] + ")";
    sel.appendChild(o);
  });
  sel.value = names.indexOf(current) !== -1 ? current : "__all__";
}

function buildWeekOptions() {
  const sel = document.getElementById("fltWeek");
  const current = sel.value;
  const weeks = allWeeks();
  const thisWeek = weekKey(new Date());
  const def = latestCompleteWeek(weeks);

  sel.textContent = "";
  weeks.slice().reverse().forEach((k) => {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = weekLabel(k) + " (" + weekRangeLabel(k) + ")" + (k === thisWeek ? " — in progress" : "");
    sel.appendChild(o);
  });
  sel.value = weeks.indexOf(current) !== -1 ? current : def;
}

/* ═══════════════════════════════════════════════════════════
   10. Export
   ═══════════════════════════════════════════════════════════ */

function exportCSV() {
  const rows = slice();
  const head = ["Date", "Campaign", "Lead", "Stage", "Contacted", "Appointment", "Contract", "Closed", "Revenue"];
  const lines = [head.join(",")];
  rows.forEach((r) => {
    lines.push([
      r.day, r.campaign, r.name, r.stage,
      r.contacted ? "yes" : "no", r.appt ? "yes" : "no",
      r.contract ? "yes" : "no", r.closed ? "yes" : "no",
      r.revenue == null ? "" : r.revenue,
    ].map(csvCell).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "crof-leads-" + dayKey(new Date()) + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* ═══════════════════════════════════════════════════════════
   11. Sample data — deterministic, so a demo looks the same twice
   ═══════════════════════════════════════════════════════════ */

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoCSV() {
  const rand = mulberry(20260810);
  // `dip` is the multiplier applied in the latest complete week, so the sample
  // tells a clear story: SEO CRMD collapses and drives most of the decline.
  const campaigns = [
    { name: "SEO CRMD", base: 11, dip: 0.25 },
    { name: "Google Ads", base: 9, dip: 1 },
    { name: "Facebook Ads", base: 7, dip: 0.7 },
    { name: "Direct Mail", base: 5, dip: 1 },
    { name: "Cold Calling", base: 8, dip: 1.1 },
    { name: "Referral", base: 3, dip: 1 },
    { name: "Zillow", base: 2, dip: 1 },
    { name: "Bandit Signs", base: 2, dip: 1 },
  ];
  const owners = ["Xander", "Rigs", "Kristie", "Marco"];
  const today = startOfDay(new Date());
  const start = addDays(weekStartOf(today), -15 * 7);      // ~15 full weeks of history
  const thisWeekStart = weekStartOf(today);
  const lastCompleteStart = addDays(thisWeekStart, -7);

  const lines = ["Date,Campaign,Lead Name,Stage,First Contact,Appointment,Contract,Closing,Revenue,Owner"];
  const first = ["Jordan", "Casey", "Alexis", "Morgan", "Devon", "Riley", "Taylor", "Sydney", "Cameron", "Avery", "Peyton", "Quinn"];
  const last = ["Whitaker", "Blake", "Ramirez", "Okafor", "Nguyen", "Delgado", "Foster", "Hollis", "Marsh", "Byrd"];

  for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
    const wkStart = weekStartOf(d);
    const isLastComplete = dayKey(wkStart) === dayKey(lastCompleteStart);
    const dow = d.getDay();
    // Weekends are quiet, midweek is busy — the shape real lead flow has.
    const dayFactor = dow === 0 ? 0.25 : dow === 6 ? 0.4 : dow === 1 ? 1.2 : 1;

    campaigns.forEach((c) => {
      // Slow seasonal drift + the engineered dip in the latest complete week.
      const weeksAgo = Math.round((thisWeekStart - wkStart) / (7 * 86400000));
      const drift = 1 + Math.sin(weeksAgo / 5) * 0.18;
      const dipFactor = isLastComplete ? c.dip : 1;
      const expected = (c.base / 7) * dayFactor * drift * dipFactor;
      let n = Math.floor(expected);
      if (rand() < expected - n) n += 1;

      for (let k = 0; k < n; k++) {
        const hour = 8 + Math.floor(rand() * 11);
        const minute = Math.floor(rand() * 60);
        const created = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
        if (created > new Date()) continue;

        // Faster response on paid, slower on organic — realistic and useful in demo.
        const lagMins = Math.round((c.name === "Cold Calling" ? 8 : c.name === "SEO CRMD" ? 95 : 35) * (0.4 + rand() * 1.8));
        const contact = new Date(created.getTime() + lagMins * 60000);

        const roll = rand();
        const contacted = roll < 0.86;
        const appt = contacted && rand() < 0.3;
        const contract = appt && rand() < 0.34;
        const closed = contract && rand() < 0.6 && created < addDays(today, -14);
        const stage = closed ? "Closed Won" : contract ? "Under Contract"
          : appt ? "Appointment Set" : contacted ? "Contacted" : "New Lead";
        const revenue = closed ? 9000 + Math.floor(rand() * 26000) : "";

        lines.push([
          dayKey(created) + " " + pad(created.getHours()) + ":" + pad(created.getMinutes()),
          c.name,
          first[Math.floor(rand() * first.length)] + " " + last[Math.floor(rand() * last.length)],
          stage,
          contacted ? dayKey(contact) + " " + pad(contact.getHours()) + ":" + pad(contact.getMinutes()) : "",
          appt ? "yes" : "",
          contract ? "yes" : "",
          closed ? "yes" : "",
          revenue,
          owners[Math.floor(rand() * owners.length)],
        ].map(csvCell).join(","));
      }
    });
  }
  return lines.join("\n");
}

function demoSpendCSV() {
  const rand = mulberry(77123);
  const spend = {
    "Google Ads": 210, "Facebook Ads": 145, "SEO CRMD": 60,
    "Direct Mail": 190, "Zillow": 95, "Bandit Signs": 30,
  };
  const today = startOfDay(new Date());
  const lines = ["Week Of,Campaign,Spend"];
  for (let m = addDays(weekStartOf(today), -15 * 7); m <= today; m = addDays(m, 7)) {
    for (const name in spend) {
      lines.push([dayKey(m), name, Math.round(spend[name] * 7 * (0.85 + rand() * 0.3))].join(","));
    }
  }
  return lines.join("\n");
}

/* ═══════════════════════════════════════════════════════════
   12. Wire-up
   ═══════════════════════════════════════════════════════════ */

function applyTheme() {
  if (state.cfg.theme) document.documentElement.dataset.theme = state.cfg.theme;
  else delete document.documentElement.dataset.theme;
}

let refreshTimer = null;
function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const secs = Number(state.cfg.refresh) || 0;
  if (!secs || state.cfg.demo || !state.cfg.sheet) return;
  refreshTimer = setInterval(() => {
    if (document.hidden) return;             // don't burn requests on a background tab
    loadData(true);
  }, secs * 1000);
}

function buildGoalInputs() {
  const grid = document.getElementById("goalGrid");
  grid.textContent = "";
  SCORECARD.forEach((m) => {
    const wrap = document.createElement("label");
    wrap.className = "goal-item";
    const lab = document.createElement("span");
    lab.className = "goal-label";
    lab.textContent = m.label + (m.fmt === "pct" ? " (%)" : "");
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.min = "0";
    input.dataset.goalKey = m.key;
    const g = goalFor(m);
    input.value = m.fmt === "pct" ? Math.round(g * 100) : g;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
  });
}

function readGoalInputs() {
  const goals = {};
  document.querySelectorAll("#goalGrid input[data-goal-key]").forEach((input) => {
    const key = input.dataset.goalKey;
    const m = SCORECARD.filter((x) => x.key === key)[0];
    if (!m || input.value === "") return;
    const n = Number(input.value);
    if (!isFinite(n)) return;
    goals[key] = m.fmt === "pct" ? n / 100 : n;
  });
  return goals;
}

function openSettings() {
  buildGoalInputs();
  document.getElementById("setSheet").value = state.cfg.sheet;
  document.getElementById("setSpend").value = state.cfg.spend;
  document.getElementById("setRefresh").value = String(state.cfg.refresh);
  document.getElementById("setPaste").value = state.cfg.paste;
  const diag = document.getElementById("setDiag");
  diag.textContent = state.rows.length
    ? "Currently loaded: " + fmtInt(state.rows.length) + " leads from " +
      (state.source === "sheet" ? "the published sheet" : state.source === "demo" ? "sample data" : "pasted CSV") + "."
    : "Nothing loaded yet.";
  document.getElementById("settingsBack").hidden = false;
}
function closeSettings() { document.getElementById("settingsBack").hidden = true; }

function init() {
  applyTheme();
  document.getElementById("fltRange").value = state.cfg.range;

  document.getElementById("btnSettings").addEventListener("click", openSettings);
  document.getElementById("btnCloseSettings").addEventListener("click", closeSettings);
  document.getElementById("settingsBack").addEventListener("click", (ev) => {
    if (ev.target.id === "settingsBack") closeSettings();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeSettings();
  });

  document.getElementById("btnSaveSettings").addEventListener("click", () => {
    state.cfg.sheet = document.getElementById("setSheet").value.trim();
    state.cfg.spend = document.getElementById("setSpend").value.trim();
    state.cfg.refresh = Number(document.getElementById("setRefresh").value);
    state.cfg.paste = document.getElementById("setPaste").value.trim();
    state.cfg.goals = readGoalInputs();
    if (state.cfg.sheet || state.cfg.paste) state.cfg.demo = false;
    saveCfg();
    closeSettings();
    scheduleRefresh();
    loadData(false);
  });

  document.getElementById("btnDemo").addEventListener("click", () => {
    state.cfg.demo = true;
    saveCfg();
    closeSettings();
    scheduleRefresh();
    loadData(false);
  });

  document.getElementById("btnClear").addEventListener("click", () => {
    state.cfg.sheet = ""; state.cfg.spend = ""; state.cfg.paste = ""; state.cfg.demo = false;
    saveCfg();
    state.rows = []; state.spend = []; state.source = "none"; state.fetchError = null;
    closeSettings();
    scheduleRefresh();
    render();
  });

  document.getElementById("btnRefresh").addEventListener("click", () => loadData(false));
  document.getElementById("btnExport").addEventListener("click", exportCSV);

  document.getElementById("btnTheme").addEventListener("click", () => {
    const isDark = document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    state.cfg.theme = isDark ? "light" : "dark";
    saveCfg();
    applyTheme();
    render();                                 // charts re-read their colours from CSS
  });

  document.getElementById("fltMerge").checked = state.cfg.merge !== false;
  document.getElementById("fltScoreWeeks").value = String(state.cfg.scoreWeeks);

  ["fltRange", "fltCampaign", "fltWeek", "fltTables", "fltScoreWeeks", "fltMerge"]
    .forEach((id) => {
      document.getElementById(id).addEventListener("change", () => {
        const node = document.getElementById(id);
        if (id === "fltRange") { state.cfg.range = node.value; saveCfg(); }
        if (id === "fltScoreWeeks") { state.cfg.scoreWeeks = node.value; saveCfg(); }
        if (id === "fltMerge") {
          state.cfg.merge = node.checked;
          saveCfg();
          applyCampaignNames();          // renames, then hues, then option lists
          assignHues();
          buildCampaignOptions();
        }
        render();
      });
    });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 160);
  });

  // Keep the "x seconds ago" pill honest without re-rendering charts.
  setInterval(updateLivePill, 15000);

  scheduleRefresh();
  loadData(false);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
