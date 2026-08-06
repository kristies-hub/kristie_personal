/* ═══════════════════════════════════════════
   Kristie's Task Planner — app logic
   Data lives in localStorage under one key.
   ═══════════════════════════════════════════ */

const STORE_KEY = "kristie-task-planner-v1";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL = { high: "🔴 Urgent", medium: "🟡 Medium", low: "🟢 Low" };
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Tasks pre-loaded for Kristie on first open (deduped by title, so
   deleting one won't bring it back). */
const SEED_TASKS = [
  { title: "Edit the marketing sheet", priority: "high", due: "2026-08-06", notes: "" },
  { title: "TC - rerunning CI assessments against the workbook", priority: "high", due: "2026-08-06",
    notes: "I guess we have our bet - if confident, are you okay with moving forward with one of them? we have other one who persistently follows-up her application, just takes time to interview again - - \"im totally good if you are\"" },
  { title: "Create sequences for leads who only have emails but don't have phone numbers", priority: "high", due: "2026-08-06", notes: "" },
  { title: "Edit the referral handoff script", priority: "medium", due: "2026-08-07", notes: "" },
  { title: "Add 'go for no' in the handbook", priority: "medium", due: "2026-08-07", notes: "" },
  { title: "Build a project to predict what caused the dip of leads from the history of the previous weeks", priority: "high", due: "2026-08-14", notes: "" },
  { title: "Create a website/zap to bypass the automation of Bloom KPIs to RD scorecard", priority: "medium", due: "2026-08-10", notes: "Placeholder due date — edit me!" },
  { title: "Edit dispo listing generator", priority: "medium", due: "2026-08-10", notes: "Placeholder due date — edit me!" },
  { title: "Add offer prompts in Yoodli", priority: "medium", due: "2026-08-10", notes: "Placeholder due date — edit me!" },
  { title: "Add the open house strategy in dispo handbook", priority: "medium", due: "2026-08-10", notes: "Placeholder due date — edit me!" },
  { title: "Emails announcing the fund", priority: "medium", due: "2026-08-10",
    notes: "One email for the existing private lenders + potential private lenders (create the lists first), and a separate one for the turnkey investors list. Placeholder due date — edit me!" },
];

/* Second batch of tasks from Kristie's tracker (2026-08-06). */
const SEED_TASKS_V2 = [
  { title: "Create website for marketing data, leads, etc", priority: "medium", due: "2026-07-30", notes: "Personal list" },
  { title: "Priority tracker / Ops website", priority: "medium", due: "2026-07-31", notes: "Personal list — this is THIS website! Check it off 🎉" },
  { title: "Create history of Rigs' mistakes", priority: "medium", due: "2026-08-04", notes: "We start a paper trail so we can reference it if we need further discipline. (Personal list)" },
  { title: "Learn n8n", priority: "medium", due: "2026-08-12", notes: "Personal list" },
  { title: "Delete old tk lists and upload the new one", priority: "medium", due: "2026-07-23", notes: "Kristie/Xander sync" },
  { title: "Add Google reviews as KPI", priority: "medium", due: "2026-08-10", notes: "Kristie/Xander sync" },
  { title: "Improve process - if no reviews within 1 week, leave a gift card incentive", priority: "medium", due: "2026-08-10", notes: "Planting the seed early. (Kristie/Xander sync)" },
  { title: "Dig deep into Google ads and FB - deals that are closed, pending; compare it to Victory - side by side numbers", priority: "medium", due: "2026-08-10", notes: "Kristie/Xander sync" },
];

/* Kristie's wins this quarter, pre-loaded into Milestones. */
const SEED_MILESTONES = [
  { title: "ROAS tracker (also updated tagging of leads)" },
  { title: "List of referral agents re-ordered by county" },
  { title: "Updated different email templates for passive marketing in ActiveCampaign" },
  { title: "Created automations for TC, Dispo, and Acq in both Fuse and Asana", notes: "Tasks when a contract has been created, auto-reminders, etc." },
  { title: "Helped revamp dispo strategy by implementing the Open House Strategy" },
  { title: "Revamped texts to VIPs / county-tagged buyers" },
  { title: "Created SMS blast website" },
  { title: "Created referral websites for agents" },
  { title: "Created TC playbook" },
  { title: "Integrated Acq Yoodli bots" },
  { title: "Created and revamped weekly seller email generator" },
  { title: "Created seller objection handler; revamped Acq and Dispo handbooks into websites" },
];

/* Kristie's weekly recurring tasks (all medium priority). Weekdays: 0=Sun…6=Sat */
const SEED_RECURRING = [
  { title: "Review team celebrations and meeting cadences", priority: "medium", freq: "weekly", weekdays: [1], monthday: null, notes: "" },
  { title: "Check all new leads and campaign health", priority: "medium", freq: "weekly", weekdays: [1], monthday: null, notes: "" },
  { title: "Update marketing sheet data", priority: "medium", freq: "weekly", weekdays: [1], monthday: null, notes: "" },
  { title: "Social media posts", priority: "medium", freq: "weekly", weekdays: [3], monthday: null, notes: "" },
  { title: "Review random calls from Acq team", priority: "medium", freq: "weekly", weekdays: [3], monthday: null, notes: "" },
  { title: "Update Peter sheet", priority: "medium", freq: "weekly", weekdays: [4], monthday: null, notes: "" },
  { title: "Update Mike Lima sheet", priority: "medium", freq: "weekly", weekdays: [4], monthday: null, notes: "" },
  { title: "Send and update Xander all contracts and lead updates", priority: "medium", freq: "weekly", weekdays: [5], monthday: null, notes: "" },
];

let state = load();
seedIfNeeded();
let calCursor = startOfMonth(new Date()); // month shown in calendar view
let selectedDay = null;                    // date string for day modal / prefilled add

/* ── storage ─────────────────────────────── */
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        tasks: data.tasks || [],
        recurring: data.recurring || [],
        recurringDone: data.recurringDone || {},
        milestones: data.milestones || [],
        icsUrl: data.icsUrl || "",
        seeded: !!data.seeded,
        seededV2: !!data.seededV2,
        seededV3: !!data.seededV3,
        dedupedV1: !!data.dedupedV1,
      };
    }
  } catch (e) { /* fall through to fresh state */ }
  return { tasks: [], recurring: [], recurringDone: {}, milestones: [], icsUrl: "", seeded: false, seededV2: false, seededV3: false, dedupedV1: false };
}

/* Fuzzy title key so "Update Peter's sheet" and "Update Peter sheet" (or
   "Social media post(s)") count as the same task: lowercase, strip
   punctuation, drop a trailing s from longer words. */
function normTitle(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").split(/\s+/).filter(Boolean)
    .map(w => (w.length > 3 && w.endsWith("s")) ? w.slice(0, -1) : w).join(" ");
}

function addSeedTasks(seeds) {
  const existing = new Set(state.tasks.map(t => t.title.trim().toLowerCase()));
  seeds.forEach(s => {
    if (!existing.has(s.title.trim().toLowerCase())) {
      state.tasks.push({ id: uid(), time: "", ...s, createdAt: new Date().toISOString(), completedAt: null });
    }
  });
}

function seedIfNeeded() {
  let dirty = false;
  if (!state.seeded) {
    addSeedTasks(SEED_TASKS);
    state.seeded = true;
    dirty = true;
  }
  if (!state.seededV2) {
    addSeedTasks(SEED_TASKS_V2);
    // fund email got a real deadline (8/13) from the CR ELT list
    const fund = state.tasks.find(t => t.title === "Emails announcing the fund" && !t.completedAt);
    if (fund && fund.due === "2026-08-10") {
      fund.due = "2026-08-13";
      fund.notes = "One email for the existing private lenders + potential private lenders (create the lists first), and a separate one for the turnkey investors list. (CR ELT weekly meeting)";
    }
    if (!state.milestones.length) {
      SEED_MILESTONES.forEach(m => state.milestones.push({ id: uid(), date: "2026-08-06", notes: "", ...m }));
    }
    state.seededV2 = true;
    dirty = true;
  }
  if (!state.seededV3) {
    const existingRec = new Set(state.recurring.map(r => normTitle(r.title)));
    SEED_RECURRING.forEach(s => {
      if (!existingRec.has(normTitle(s.title))) state.recurring.push({ id: uid(), ...s });
    });
    state.seededV3 = true;
    dirty = true;
  }
  if (!state.dedupedV1) {
    // one-time cleanup: pre-loaded recurring tasks that fuzzy-match one Kristie
    // added herself get removed — her copy (with her days/notes) wins
    const seedTitles = new Set(SEED_RECURRING.map(s => s.title));
    const byNorm = {};
    state.recurring.forEach(r => { const k = normTitle(r.title); (byNorm[k] = byNorm[k] || []).push(r); });
    const removeIds = new Set();
    Object.values(byNorm).forEach(group => {
      if (group.length < 2) return;
      const seeded = group.filter(r => seedTitles.has(r.title) && !(r.notes || ""));
      const kept = group.filter(r => !seeded.includes(r));
      const removed = kept.length ? seeded : group.slice(1);
      const keeper = kept.length ? kept[0] : group[0];
      removed.forEach(r => removeIds.add(r.id));
      // carry over any check-off marks from removed copies
      const removedIds = new Set(removed.map(r => r.id));
      Object.keys(state.recurringDone).forEach(key => {
        const [rid, ds] = key.split("|");
        if (removedIds.has(rid)) {
          if (state.recurringDone[key]) state.recurringDone[keeper.id + "|" + ds] = true;
          delete state.recurringDone[key];
        }
      });
    });
    state.recurring = state.recurring.filter(r => !removeIds.has(r.id));
    state.dedupedV1 = true;
    dirty = true;
  }
  if (dirty) save();
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    alert("Browser storage is full — probably too many attached images. Remove some images (or delete old completed tasks) and try again.");
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ── date helpers (all local-time, no UTC surprises) ── */
function todayStr() { return dateToStr(new Date()); }

function dateToStr(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function strToDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

function friendlyDate(s) {
  const d = strToDate(s);
  const t = strToDate(todayStr());
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const opts = { month: "short", day: "numeric" };
  if (d.getFullYear() !== t.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString(undefined, opts);
}

/* ── recurring helpers ───────────────────── */
function recurringDueOn(rec, dateStr) {
  const d = strToDate(dateStr);
  if (rec.freq === "daily") return true;
  if (rec.freq === "weekly") return (rec.weekdays || []).includes(d.getDay());
  if (rec.freq === "monthly") {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === Math.min(rec.monthday || 1, lastDay);
  }
  return false;
}

function recDoneKey(recId, dateStr) { return recId + "|" + dateStr; }
function isRecDone(recId, dateStr) { return !!state.recurringDone[recDoneKey(recId, dateStr)]; }

function recWhenLabel(rec) {
  if (rec.freq === "daily") return "Every day";
  if (rec.freq === "weekly") {
    const days = (rec.weekdays || []).slice().sort().map(d => WEEKDAY_NAMES[d]);
    if (days.length === 0) return "Weekly (no day set)";
    if (days.length === 1) return "Every " + days[0];
    return "Every " + days.map(d => d.slice(0, 3)).join(", ");
  }
  if (rec.freq === "monthly") return "Monthly on day " + (rec.monthday || 1);
  return "";
}

/* ── generic helpers ─────────────────────── */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function openTasks() { return state.tasks.filter(t => !t.completedAt); }

function sortTasks(list) {
  return list.slice().sort((a, b) => {
    const ta = a.time || "99:99", tb = b.time || "99:99"; // timed tasks first, in hour order
    return (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) ||
      (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) ||
      (ta < tb ? -1 : ta > tb ? 1 : 0) ||
      a.title.localeCompare(b.title);
  });
}

function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  const h12 = h % 12 || 12;
  return h12 + ":" + String(m).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM");
}

/* ═══════════════════════════════════════════
   RENDERING
   ═══════════════════════════════════════════ */

function renderAll() {
  renderToday();
  renderUpcoming();
  renderCalendar();
  renderAllTasks();
  renderRecurring();
  renderMilestones();
  renderDone();
}

/* ── task card HTML ──────────────────────── */
function taskCardHTML(t, opts = {}) {
  const done = !!t.completedAt;
  const overdue = !done && t.due < todayStr();
  return `
  <div class="task-card pri-${t.priority}">
    <button class="task-check ${done ? "checked" : ""}" data-action="toggle-task" data-id="${t.id}" title="${done ? "Mark as not done" : "Mark as done"}">✓</button>
    <div class="task-body">
      <div class="task-title ${done ? "done" : ""}">${esc(t.title)}</div>
      <div class="task-meta">
        <span class="badge badge-${t.priority}">${PRIORITY_LABEL[t.priority]}</span>
        ${overdue ? `<span class="badge badge-overdue">⚠ OVERDUE — was due ${esc(friendlyDate(t.due))}</span>`
                  : `<span class="badge badge-date">📅 Due ${esc(friendlyDate(t.due))}</span>`}
        ${t.time ? `<span class="badge badge-date">⏰ ${formatTime(t.time)}</span>` : ""}
        ${done && opts.showCompletedDate ? `<span class="badge badge-date">✅ Done ${esc(friendlyDate(t.completedAt.slice(0, 10)))}</span>` : ""}
      </div>
      ${t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ""}
      ${(t.images || []).length ? `<div class="task-imgs">${t.images.map(src => `<img class="task-img" src="${src}" alt="attached screenshot">`).join("")}</div>` : ""}
    </div>
    ${opts.pushMilestone ? `<button class="btn btn-ghost btn-small push-ms" data-action="push-milestone" data-id="${t.id}" title="Add this to Milestones">🌟 Push to Milestones</button>` : ""}
    ${done ? "" : `<button class="task-edit" data-action="start-timer" data-title="${esc(t.title)}" title="Start focus timer">⏱️</button>`}
    <button class="task-edit" data-action="edit-task" data-id="${t.id}" title="Edit">✏️</button>
  </div>`;
}

function recCardHTML(rec, dateStr) {
  const done = isRecDone(rec.id, dateStr);
  return `
  <div class="task-card is-recurring">
    <button class="task-check ${done ? "checked" : ""}" data-action="toggle-rec" data-id="${rec.id}" data-date="${dateStr}" title="${done ? "Mark as not done" : "Mark as done"}">✓</button>
    <div class="task-body">
      <div class="task-title ${done ? "done" : ""}">${esc(rec.title)}</div>
      <div class="task-meta">
        <span class="badge badge-recurring">🔁 ${esc(recWhenLabel(rec))}</span>
        <span class="badge badge-${rec.priority}">${PRIORITY_LABEL[rec.priority]}</span>
      </div>
      ${rec.notes ? `<div class="task-notes">${esc(rec.notes)}</div>` : ""}
    </div>
    ${done ? "" : `<button class="task-edit" data-action="start-timer" data-title="${esc(rec.title)}" title="Start focus timer">⏱️</button>`}
    <button class="task-edit" data-action="edit-rec" data-id="${rec.id}" title="Edit">✏️</button>
  </div>`;
}

/* ── TODAY view ──────────────────────────── */
function renderToday() {
  const today = todayStr();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning, Kristie! ☕" : hour < 17 ? "Good afternoon, Kristie! 🌤️" : "Good evening, Kristie! 🌙";
  document.getElementById("todayGreeting").textContent = greeting;
  document.getElementById("todayDate").textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const open = openTasks();
  const overdue = sortTasks(open.filter(t => t.due < today));
  const dueTodayHigh = sortTasks(open.filter(t => t.due === today && t.priority === "high"));
  const dueTodayMed = sortTasks(open.filter(t => t.due === today && t.priority === "medium"));
  const dueTodayLow = sortTasks(open.filter(t => t.due === today && t.priority === "low"));
  const recsToday = state.recurring.filter(r => recurringDueOn(r, today))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const recsNotDone = recsToday.filter(r => !isRecDone(r.id, today));

  // "do first" = overdue anything + urgent due today + urgent recurring not done
  const mustDoCount = overdue.length + dueTodayHigh.length + recsNotDone.filter(r => r.priority === "high").length;

  const banner = document.getElementById("urgentBanner");
  if (mustDoCount > 0) {
    banner.innerHTML = `<div class="urgent-banner">🚨 Finish ${mustDoCount === 1 ? "this 1 task" : "these " + mustDoCount + " tasks"} before diving into anything else!</div>`;
  } else if (dueTodayMed.length + dueTodayLow.length + recsNotDone.length > 0) {
    banner.innerHTML = `<div class="allclear-banner">✅ Nothing urgent right now — you're on top of the big stuff. Work through the rest below.</div>`;
  } else {
    banner.innerHTML = `<div class="allclear-banner">🎉 All clear for today! Check the calendar for what's coming up.</div>`;
  }

  const sections = [];

  if (overdue.length) {
    sections.push(sectionHTML("⚠️ Overdue — catch up on these first", overdue.map(t => taskCardHTML(t)).join(""), overdue.length));
  }
  if (dueTodayHigh.length) {
    sections.push(sectionHTML("🔴 Urgent — due today", dueTodayHigh.map(t => taskCardHTML(t)).join(""), dueTodayHigh.length));
  }
  if (recsToday.length) {
    sections.push(sectionHTML("🔁 Today's recurring tasks", recsToday.map(r => recCardHTML(r, today)).join(""), recsToday.length));
  }
  if (dueTodayMed.length) {
    sections.push(sectionHTML("🟡 Medium — due today", dueTodayMed.map(t => taskCardHTML(t)).join(""), dueTodayMed.length));
  }
  if (dueTodayLow.length) {
    sections.push(sectionHTML("🟢 Low — due today (only if time allows)", dueTodayLow.map(t => taskCardHTML(t)).join(""), dueTodayLow.length));
  }

  if (!sections.length) {
    sections.push(`<div class="empty-note">No tasks yet. Click <strong>+ Add Task</strong> to get started, or add your repetitive tasks under <strong>🔁 Recurring</strong>.</div>`);
  }

  document.getElementById("todaySections").innerHTML = sections.join("");
  renderMeetings();
}

function sectionHTML(title, body, count) {
  return `<div class="today-section"><h3>${title} <span class="section-count">${count}</span></h3>${body}</div>`;
}

/* ── UPCOMING view ───────────────────────── */
function renderUpcoming() {
  const today = todayStr();
  const upcoming = sortTasks(openTasks().filter(t => t.due > today));
  const el = document.getElementById("upcomingList");
  if (!upcoming.length) {
    el.innerHTML = `<div class="empty-note">Nothing scheduled ahead — add tasks with future due dates and they'll line up here.</div>`;
    return;
  }
  let html = "", lastDue = null;
  for (const t of upcoming) {
    if (t.due !== lastDue) {
      lastDue = t.due;
      html += `<div class="group-header">${esc(friendlyDate(t.due))} — ${esc(strToDate(t.due).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }))}</div>`;
    }
    html += taskCardHTML(t);
  }
  el.innerHTML = html;
}

/* ── MILESTONES view ─────────────────────── */
function renderMilestones() {
  const el = document.getElementById("milestonesList");
  if (!state.milestones.length) {
    el.innerHTML = `<div class="empty-note">No milestones yet — when you ship something big, log it here so it never gets forgotten.</div>`;
    return;
  }
  const sorted = state.milestones.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  let html = `<div class="group-header">Quarterly Milestones 🏆</div>`;
  for (const m of sorted) {
    html += `
    <div class="milestone-card">
      <div class="milestone-icon">🌟</div>
      <div class="milestone-body">
        <div class="milestone-title">${esc(m.title)}</div>
        ${m.notes ? `<div class="milestone-notes">${esc(m.notes)}</div>` : ""}
      </div>
      <button class="task-edit" data-action="edit-milestone" data-id="${m.id}" title="Edit">✏️</button>
    </div>`;
  }
  el.innerHTML = html;
}

/* ── CALENDAR view ───────────────────────── */
function renderCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  document.getElementById("calTitle").textContent = calCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const first = new Date(y, m, 1);
  const gridStart = new Date(y, m, 1 - first.getDay());
  const today = todayStr();
  const open = openTasks();
  const cells = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const ds = dateToStr(d);
    const inMonth = d.getMonth() === m;
    const dayTasks = sortTasks(open.filter(t => t.due === ds));
    const dayRecs = state.recurring.filter(r => recurringDueOn(r, ds));

    const chips = [];
    const dots = [];
    dayTasks.forEach(t => {
      chips.push(`<div class="cal-chip chip-${t.priority}">${esc(t.title)}</div>`);
      dots.push(`<span class="dot dot-${t.priority}"></span>`);
    });
    dayRecs.forEach(r => {
      const done = isRecDone(r.id, ds);
      chips.push(`<div class="cal-chip chip-recurring ${done ? "chip-done" : ""}">🔁 ${esc(r.title)}</div>`);
      dots.push(`<span class="dot dot-recurring"></span>`);
    });

    const shown = chips.slice(0, 3);
    const more = chips.length - shown.length;

    cells.push(`
      <div class="cal-day ${inMonth ? "" : "other-month"} ${ds === today ? "is-today" : ""}" data-action="open-day" data-date="${ds}">
        <div class="cal-day-num">${d.getDate()}</div>
        ${shown.join("")}
        ${more > 0 ? `<div class="cal-more">+${more} more</div>` : ""}
        <div class="cal-dots">${dots.slice(0, 8).join("")}</div>
      </div>`);
  }
  document.getElementById("calGrid").innerHTML = cells.join("");
}

/* ── ALL TASKS view ──────────────────────── */
function renderAllTasks() {
  const open = openTasks();
  const el = document.getElementById("allTasksList");
  if (!open.length) {
    el.innerHTML = `<div class="empty-note">No open tasks — either you're all caught up 🎉 or it's time to add some!</div>`;
    return;
  }
  const groups = ["high", "medium", "low"].map(p => {
    const list = sortTasks(open.filter(t => t.priority === p));
    if (!list.length) return "";
    return `<div class="group-header">${PRIORITY_LABEL[p]} (${list.length})</div>` + list.map(t => taskCardHTML(t)).join("");
  });
  el.innerHTML = groups.join("");
}

/* ── RECURRING view ──────────────────────── */
function renderRecurring() {
  const el = document.getElementById("recurringList");
  if (!state.recurring.length) {
    el.innerHTML = `<div class="empty-note">No recurring tasks yet. Add things like <em>"Update Peter's sheet — every Thursday"</em> and they'll show up automatically on your Today page.</div>`;
    return;
  }
  const sorted = state.recurring.slice().sort((a, b) =>
    (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || a.title.localeCompare(b.title));
  el.innerHTML = sorted.map(rec => `
    <div class="task-card is-recurring">
      <div class="task-body">
        <div class="task-title">${esc(rec.title)}</div>
        <div class="task-meta">
          <span class="rec-when">🔁 ${esc(recWhenLabel(rec))}</span>
          <span class="badge badge-${rec.priority}">${PRIORITY_LABEL[rec.priority]}</span>
        </div>
        ${rec.notes ? `<div class="task-notes">${esc(rec.notes)}</div>` : ""}
      </div>
      <button class="task-edit" data-action="edit-rec" data-id="${rec.id}" title="Edit">✏️</button>
    </div>`).join("");
}

/* ── COMPLETED view ──────────────────────── */
function renderDone() {
  const doneTasks = state.tasks.filter(t => t.completedAt);
  const recEntries = Object.keys(state.recurringDone).filter(k => state.recurringDone[k]).map(k => {
    const [recId, dateStr] = k.split("|");
    const rec = state.recurring.find(r => r.id === recId);
    return rec ? { rec, dateStr } : null;
  }).filter(Boolean);

  // stats
  const today = todayStr();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoStr = dateToStr(weekAgo);
  const doneToday = doneTasks.filter(t => t.completedAt.slice(0, 10) === today).length +
    recEntries.filter(e => e.dateStr === today).length;
  const doneWeek = doneTasks.filter(t => t.completedAt.slice(0, 10) >= weekAgoStr).length +
    recEntries.filter(e => e.dateStr >= weekAgoStr).length;
  const doneTotal = doneTasks.length + recEntries.length;

  document.getElementById("doneStats").innerHTML = `
    <div class="stat-tile"><div class="stat-num">${doneToday}</div><div class="stat-label">done today</div></div>
    <div class="stat-tile"><div class="stat-num">${doneWeek}</div><div class="stat-label">last 7 days</div></div>
    <div class="stat-tile"><div class="stat-num">${doneTotal}</div><div class="stat-label">all time</div></div>`;

  const el = document.getElementById("doneList");
  if (!doneTotal) {
    el.innerHTML = `<div class="empty-note">Nothing completed yet — your first checked-off task will land here. You've got this! 💪</div>`;
    return;
  }

  // merge + group by completion date, newest first
  const entries = [
    ...doneTasks.map(t => ({ type: "task", date: t.completedAt.slice(0, 10), t })),
    ...recEntries.map(e => ({ type: "rec", date: e.dateStr, rec: e.rec })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  let html = "", lastDate = null;
  for (const e of entries) {
    if (e.date !== lastDate) {
      lastDate = e.date;
      html += `<div class="group-header">${esc(friendlyDate(e.date))} — ${esc(strToDate(e.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }))}</div>`;
    }
    html += e.type === "task" ? taskCardHTML(e.t, { pushMilestone: true }) : recCardHTML(e.rec, e.date);
  }
  el.innerHTML = html;
}

/* ═══════════════════════════════════════════
   OUTLOOK CALENDAR (published ICS link)
   Best-effort ICS parsing: single events plus
   common DAILY/WEEKLY/MONTHLY/YEARLY repeats.
   ═══════════════════════════════════════════ */

const ICS_CACHE_KEY = "kristie-task-planner-ics-cache";
let icsEvents = [];
let icsError = null;
let icsFetchedAt = null;

function icsUnfold(text) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").replace(/\r/g, "");
}

function parseICSDate(value) {
  if (/^\d{8}$/.test(value)) {
    return { allDay: true, date: new Date(+value.slice(0, 4), +value.slice(4, 6) - 1, +value.slice(6, 8)) };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  // Zulu times convert from UTC; TZID/floating times are treated as local
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return { allDay: false, date };
}

function parseICS(text) {
  const lines = icsUnfold(text).split("\n");
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = { exdates: new Set() }; continue; }
    if (line === "END:VEVENT") { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const keyPart = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = keyPart.split(";")[0];
    if (key === "SUMMARY") cur.summary = value.replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\;/g, ";");
    else if (key === "LOCATION") cur.location = value.replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\;/g, ";");
    else if (key === "UID") cur.uid = value;
    else if (key === "STATUS") cur.status = value;
    else if (key === "RRULE") {
      cur.rrule = {};
      value.split(";").forEach(p => { const [k, v] = p.split("="); if (k) cur.rrule[k] = v; });
    }
    else if (key === "EXDATE") value.split(",").forEach(v => { const p = parseICSDate(v.trim()); if (p) cur.exdates.add(dateToStr(p.date)); });
    else if (key === "RECURRENCE-ID") { const p = parseICSDate(value); if (p) cur.recurrenceId = dateToStr(p.date); }
    else if (key === "DTSTART") cur.start = parseICSDate(value);
    else if (key === "DTEND") cur.end = parseICSDate(value);
  }
  // occurrence overrides (RECURRENCE-ID) replace that date of the parent series
  const overridden = {};
  events.forEach(ev => { if (ev.recurrenceId && ev.uid) (overridden[ev.uid] = overridden[ev.uid] || new Set()).add(ev.recurrenceId); });
  events.forEach(ev => {
    if (!ev.recurrenceId && ev.uid && overridden[ev.uid]) overridden[ev.uid].forEach(ds => ev.exdates.add(ds));
  });
  return events.filter(ev => ev.start && ev.summary && ev.status !== "CANCELLED");
}

const BYDAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function nthWeekdayOfMonth(year, month, weekday, nth) {
  if (nth > 0) {
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return 1 + offset + (nth - 1) * 7;
  }
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return last.getDate() - offset + (nth + 1) * 7;
}

function eventOccursOn(ev, dateStr) {
  const target = strToDate(dateStr);
  const start = ev.start.date;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (ev.exdates.has(dateStr)) return false;
  if (!ev.rrule) return dateToStr(start) === dateStr;
  if (target < startDay) return false;

  const r = ev.rrule;
  const interval = Math.max(1, parseInt(r.INTERVAL || "1", 10));
  if (r.UNTIL) { const u = parseICSDate(r.UNTIL); if (u && target > u.date) return false; }
  const dayMs = 86400000;
  const daysDiff = Math.round((target - startDay) / dayMs);

  if (r.FREQ === "DAILY") {
    if (daysDiff % interval !== 0) return false;
    if (r.COUNT && daysDiff / interval >= +r.COUNT) return false;
    return true;
  }
  if (r.FREQ === "WEEKLY") {
    const bydays = r.BYDAY ? r.BYDAY.split(",").map(d => BYDAY_MAP[d.trim()]).filter(d => d !== undefined) : [start.getDay()];
    if (!bydays.includes(target.getDay())) return false;
    const weekStart = d => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x; };
    const weeksDiff = Math.round((weekStart(target) - weekStart(startDay)) / (7 * dayMs));
    if (weeksDiff % interval !== 0) return false;
    if (r.COUNT) { // count occurrences from series start through target
      let n = 0;
      for (let i = 0; i <= daysDiff; i++) {
        const d = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + i);
        if (d < startDay) continue;
        const w = Math.round((weekStart(d) - weekStart(startDay)) / (7 * dayMs));
        if (w % interval === 0 && bydays.includes(d.getDay())) n++;
      }
      if (n > +r.COUNT) return false;
    }
    return true;
  }
  if (r.FREQ === "MONTHLY") {
    const monthsDiff = (target.getFullYear() - startDay.getFullYear()) * 12 + (target.getMonth() - startDay.getMonth());
    if (monthsDiff % interval !== 0) return false;
    if (r.COUNT && monthsDiff / interval >= +r.COUNT) return false;
    if (r.BYMONTHDAY) return target.getDate() === +r.BYMONTHDAY;
    if (r.BYDAY) {
      const m = r.BYDAY.match(/^(-?\d)([A-Z]{2})$/);
      if (m) return target.getDate() === nthWeekdayOfMonth(target.getFullYear(), target.getMonth(), BYDAY_MAP[m[2]], +m[1]);
      return BYDAY_MAP[r.BYDAY] === target.getDay();
    }
    return target.getDate() === startDay.getDate();
  }
  if (r.FREQ === "YEARLY") {
    const yearsDiff = target.getFullYear() - startDay.getFullYear();
    if (yearsDiff % interval !== 0) return false;
    if (r.COUNT && yearsDiff / interval >= +r.COUNT) return false;
    return target.getMonth() === startDay.getMonth() && target.getDate() === startDay.getDate();
  }
  return false;
}

function meetingsOn(dateStr) {
  const target = strToDate(dateStr);
  return icsEvents.filter(ev => eventOccursOn(ev, dateStr)).map(ev => {
    const s = ev.start.date;
    const occStart = ev.start.allDay ? null : new Date(target.getFullYear(), target.getMonth(), target.getDate(), s.getHours(), s.getMinutes());
    const durMs = ev.end && !ev.start.allDay ? (ev.end.date - ev.start.date) : 0;
    return {
      summary: ev.summary,
      location: ev.location || "",
      allDay: ev.start.allDay,
      start: occStart,
      end: occStart && durMs > 0 ? new Date(occStart.getTime() + durMs) : null,
    };
  }).sort((a, b) => (a.allDay ? -1 : b.allDay ? 1 : a.start - b.start));
}

function fmtClock(d) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/* Outlook blocks direct browser fetches (CORS), so when the site is served
   from Netlify we retry through the /ics-proxy/* redirect (see _redirects),
   which makes Netlify fetch the calendar server-side. */
function icsCandidates(url) {
  const list = [url];
  try {
    const u = new URL(url);
    if (location.protocol === "http:" || location.protocol === "https:") {
      if (u.hostname === "outlook.office365.com") list.push("/ics-proxy/office365" + u.pathname + u.search);
      else if (u.hostname === "outlook.live.com") list.push("/ics-proxy/live" + u.pathname + u.search);
    }
  } catch { /* not a valid URL — direct attempt will surface the error */ }
  return list;
}

async function fetchMeetings(force) {
  if (!state.icsUrl) { icsEvents = []; icsError = null; renderMeetings(); return; }
  let lastError = null;
  for (const url of icsCandidates(state.icsUrl)) {
    try {
      const res = await fetch(url, force ? { cache: "reload" } : {});
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (!text.includes("BEGIN:VCALENDAR")) throw new Error("not a calendar file");
      icsEvents = parseICS(text);
      icsError = null;
      icsFetchedAt = new Date();
      try { localStorage.setItem(ICS_CACHE_KEY, JSON.stringify({ fetchedAt: icsFetchedAt.toISOString(), text })); } catch { /* cache too big — skip */ }
      renderMeetings();
      return;
    } catch (e) {
      lastError = e.message || "fetch failed";
    }
  }
  icsError = lastError;
  renderMeetings();
}

function loadMeetingsFromCache() {
  try {
    const raw = localStorage.getItem(ICS_CACHE_KEY);
    if (!raw) return;
    const cache = JSON.parse(raw);
    icsEvents = parseICS(cache.text);
    icsFetchedAt = new Date(cache.fetchedAt);
  } catch { /* ignore bad cache */ }
}

function renderMeetings() {
  const el = document.getElementById("meetingsSection");
  if (!state.icsUrl) {
    el.innerHTML = `<div class="connect-cal-note">📅 Want your Outlook meetings to show up here every morning?
      <button class="btn btn-ghost btn-small" data-action="connect-cal">Connect calendar</button></div>`;
    return;
  }
  const meetings = meetingsOn(todayStr());
  let body = "";
  if (icsError && !icsEvents.length) {
    body = `<div class="cal-error">⚠️ Couldn't load your calendar (${esc(icsError)}). Outlook may be blocking browser access to the link — tell Claude and we'll set up a workaround.</div>`;
  } else if (!meetings.length) {
    body = `<div class="empty-note">No meetings today — a full focus day! 🎉</div>`;
  } else {
    body = meetings.map(m => `
      <div class="meeting-card">
        <span class="meeting-time">${m.allDay ? "All day" : esc(fmtClock(m.start)) + (m.end ? " – " + esc(fmtClock(m.end)) : "")}</span>
        <span class="meeting-title">${esc(m.summary)}</span>
        ${m.location ? `<span class="meeting-loc">📍 ${esc(m.location)}</span>` : ""}
      </div>`).join("");
  }
  el.innerHTML = `
    <div class="meetings-box">
      <div class="meetings-header">
        <h3>📅 Today's meetings ${meetings.length ? `<span class="section-count">${meetings.length}</span>` : ""}</h3>
        <div class="meetings-tools">
          ${icsFetchedAt ? `updated ${esc(fmtClock(icsFetchedAt))}` : ""}
          <button data-action="refresh-cal">↻ refresh</button>
          <button data-action="connect-cal">⚙️ settings</button>
        </div>
      </div>
      ${body}
    </div>`;
}

/* ═══════════════════════════════════════════
   POMODORO / FOCUS TIMER
   ═══════════════════════════════════════════ */

let timer = null; // {title, endsAt, remainingMs, paused, finished}
let timerInterval = null;
let audioCtx = null;
let alarmTimer = null;
let alarmCount = 0;

/* The AudioContext is created on Start (a user gesture) so the browser
   allows the alarm to actually make sound later. */
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch { /* audio unavailable */ }
}

function playAlarmBurst() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume();
    let t = audioCtx.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = "square";
      o.frequency.value = i % 2 ? 660 : 990;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.start(t); o.stop(t + 0.3);
      t += 0.32;
    }
  } catch { /* audio unavailable */ }
}

function startAlarm() {
  stopAlarm();
  playAlarmBurst();
  alarmCount = 0;
  // keep ringing every 3s (about 45s total) until dismissed
  alarmTimer = setInterval(() => {
    if (++alarmCount >= 15) { stopAlarm(); return; }
    playAlarmBurst();
  }, 3000);
}

function stopAlarm() {
  clearInterval(alarmTimer);
  alarmTimer = null;
}

function openTimerModal(title) {
  document.getElementById("timerTaskName").textContent = title;
  document.getElementById("timerCustom").value = "";
  document.querySelectorAll("#timerPresets .pri-btn").forEach(b => b.classList.toggle("selected", b.dataset.min === "25"));
  document.getElementById("timerModal").hidden = false;
}

function startTimer(title, minutes) {
  timer = { title, endsAt: Date.now() + minutes * 60000, paused: false, finished: false };
  ensureAudio();
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 500);
  tickTimer();
}

function stopTimer() {
  timer = null;
  clearInterval(timerInterval);
  stopAlarm();
  document.getElementById("timerBar").hidden = true;
  document.title = "Kristie's Task Planner";
}

function tickTimer() {
  if (!timer) return;
  const remaining = timer.paused ? timer.remainingMs : timer.endsAt - Date.now();
  if (remaining <= 0 && !timer.finished) {
    timer.finished = true;
    startAlarm();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("⏰ Time's up!", { body: timer.title });
    }
  }
  renderTimerBar(Math.max(0, remaining));
}

function renderTimerBar(remaining) {
  const bar = document.getElementById("timerBar");
  bar.hidden = false;
  if (timer.finished) {
    bar.className = "timer-done";
    bar.innerHTML = `<span class="timer-count">⏰</span>
      <span class="timer-label">Time's up — ${esc(timer.title)}</span>
      <button data-action="timer-stop">Done ✓</button>
      <button data-action="timer-plus5">+5 min</button>`;
    document.title = "⏰ Time's up! — Kristie's Task Planner";
    return;
  }
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const clock = mins + ":" + String(secs).padStart(2, "0");
  bar.className = "";
  bar.innerHTML = `<span class="timer-count">${clock}</span>
    <span class="timer-label">⏱ ${esc(timer.title)}</span>
    <button data-action="timer-pause">${timer.paused ? "▶ Resume" : "⏸ Pause"}</button>
    <button data-action="timer-plus5">+5</button>
    <button data-action="timer-stop">✕</button>`;
  document.title = clock + " ⏱ — Kristie's Task Planner";
}

/* ═══════════════════════════════════════════
   MODALS
   ═══════════════════════════════════════════ */

function setPriorityPicker(pickerId, value) {
  document.querySelectorAll("#" + pickerId + " .pri-btn").forEach(b =>
    b.classList.toggle("selected", b.dataset.value === value));
}
function getPriorityPicker(pickerId) {
  const sel = document.querySelector("#" + pickerId + " .pri-btn.selected");
  return sel ? sel.dataset.value : "medium";
}

/* ── task images (pasted screenshots) ────── */
let modalImages = []; // working copy while the task modal is open

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1280;
      const scale = Math.min(1, MAX / img.width, MAX / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error("bad image")); };
    img.src = URL.createObjectURL(file);
  });
}

async function addModalImages(files) {
  for (const f of files) {
    try { modalImages.push(await compressImage(f)); } catch { /* skip non-images */ }
  }
  renderModalImages();
}

function renderModalImages() {
  document.getElementById("taskImages").innerHTML = modalImages.map((src, i) => `
    <div class="thumb"><img src="${src}" alt="attached"><button type="button" class="thumb-x" data-i="${i}" title="Remove">✕</button></div>`).join("");
}

function openTaskModal(task, prefillDate) {
  document.getElementById("taskModalTitle").textContent = task ? "Edit Task" : "Add Task";
  document.getElementById("taskId").value = task ? task.id : "";
  document.getElementById("taskTitle").value = task ? task.title : "";
  document.getElementById("taskDue").value = task ? task.due : (prefillDate || todayStr());
  document.getElementById("taskTime").value = task ? (task.time || "") : "";
  document.getElementById("taskNotes").value = task ? (task.notes || "") : "";
  setPriorityPicker("taskPriority", task ? task.priority : "high");
  modalImages = task && task.images ? task.images.slice() : [];
  renderModalImages();
  document.getElementById("taskDelete").hidden = !task;
  document.getElementById("taskModal").hidden = false;
  document.getElementById("taskTitle").focus();
}

function openRecModal(rec) {
  document.getElementById("recModalTitle").textContent = rec ? "Edit Recurring Task" : "Add Recurring Task";
  document.getElementById("recId").value = rec ? rec.id : "";
  document.getElementById("recTitle").value = rec ? rec.title : "";
  document.getElementById("recNotes").value = rec ? (rec.notes || "") : "";
  document.getElementById("recFreq").value = rec ? rec.freq : "weekly";
  document.getElementById("recMonthday").value = rec && rec.monthday ? rec.monthday : 1;
  setPriorityPicker("recPriority", rec ? rec.priority : "medium");
  const days = rec && rec.weekdays ? rec.weekdays : [];
  document.querySelectorAll("#recWeekdays button").forEach(b =>
    b.classList.toggle("selected", days.includes(Number(b.dataset.day))));
  updateRecFreqUI();
  document.getElementById("recDelete").hidden = !rec;
  document.getElementById("recModal").hidden = false;
  document.getElementById("recTitle").focus();
}

function updateRecFreqUI() {
  const freq = document.getElementById("recFreq").value;
  document.getElementById("recWeekdaysWrap").hidden = freq !== "weekly";
  document.getElementById("recMonthdayWrap").hidden = freq !== "monthly";
}

function openDayModal(dateStr) {
  selectedDay = dateStr;
  const d = strToDate(dateStr);
  document.getElementById("dayModalTitle").textContent =
    d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const dayTasks = sortTasks(state.tasks.filter(t => t.due === dateStr));
  const dayRecs = state.recurring.filter(r => recurringDueOn(r, dateStr));

  let html = "";
  if (dayTasks.length) html += dayTasks.map(t => taskCardHTML(t)).join("");
  if (dayRecs.length) html += dayRecs.map(r => recCardHTML(r, dateStr)).join("");
  if (!html) html = `<div class="empty-note">Nothing scheduled this day.</div>`;
  document.getElementById("dayModalBody").innerHTML = html;
  document.getElementById("dayModal").hidden = false;
}

function openMilestoneModal(m, prefill) {
  document.getElementById("msModalTitle").textContent = m ? "Edit Milestone" : (prefill ? "Push to Milestones 🌟" : "Add Milestone");
  document.getElementById("msId").value = m ? m.id : "";
  document.getElementById("msTitle").value = m ? m.title : (prefill ? prefill.title : "");
  document.getElementById("msDate").value = m ? m.date : (prefill && prefill.date ? prefill.date : todayStr());
  document.getElementById("msNotes").value = m ? (m.notes || "") : (prefill ? prefill.notes : "");
  document.getElementById("msDelete").hidden = !m;
  document.getElementById("msModal").hidden = false;
  document.getElementById("msTitle").focus();
}

function openCalModal() {
  document.getElementById("calUrl").value = state.icsUrl || "";
  document.getElementById("calDisconnect").hidden = !state.icsUrl;
  document.getElementById("calModal").hidden = false;
}

function closeModals() {
  ["taskModal", "recModal", "dayModal", "msModal", "calModal", "timerModal", "imgModal"].forEach(id =>
    document.getElementById(id).hidden = true);
}

/* ═══════════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════════ */

// tab switching
document.getElementById("tabs").addEventListener("click", e => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + tab.dataset.view).classList.add("active");
});

// delegated clicks: checkboxes, edit buttons, calendar days
document.body.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "toggle-task") {
    const t = state.tasks.find(x => x.id === el.dataset.id);
    if (t) {
      t.completedAt = t.completedAt ? null : new Date().toISOString();
      save(); renderAll();
      if (!document.getElementById("dayModal").hidden && selectedDay) openDayModal(selectedDay);
    }
  }
  if (action === "toggle-rec") {
    const key = recDoneKey(el.dataset.id, el.dataset.date);
    if (state.recurringDone[key]) delete state.recurringDone[key];
    else state.recurringDone[key] = true;
    save(); renderAll();
    if (!document.getElementById("dayModal").hidden && selectedDay) openDayModal(selectedDay);
  }
  if (action === "edit-task") {
    closeModals();
    openTaskModal(state.tasks.find(x => x.id === el.dataset.id));
  }
  if (action === "edit-rec") {
    closeModals();
    openRecModal(state.recurring.find(x => x.id === el.dataset.id));
  }
  if (action === "open-day") {
    openDayModal(el.dataset.date);
  }
  if (action === "edit-milestone") {
    closeModals();
    openMilestoneModal(state.milestones.find(x => x.id === el.dataset.id));
  }
  if (action === "push-milestone") {
    const t = state.tasks.find(x => x.id === el.dataset.id);
    if (t) {
      closeModals();
      openMilestoneModal(null, {
        title: t.title,
        date: t.completedAt ? t.completedAt.slice(0, 10) : todayStr(),
        notes: t.notes || "",
      });
    }
  }
  if (action === "connect-cal") openCalModal();
  if (action === "refresh-cal") fetchMeetings(true);
  if (action === "start-timer") openTimerModal(el.dataset.title);
  if (action === "timer-pause") {
    if (timer.paused) { timer.endsAt = Date.now() + timer.remainingMs; timer.paused = false; }
    else { timer.remainingMs = Math.max(0, timer.endsAt - Date.now()); timer.paused = true; }
    tickTimer();
  }
  if (action === "timer-plus5") {
    if (timer.finished) { timer.finished = false; timer.paused = false; timer.endsAt = Date.now() + 5 * 60000; stopAlarm(); }
    else if (timer.paused) timer.remainingMs += 5 * 60000;
    else timer.endsAt += 5 * 60000;
    tickTimer();
  }
  if (action === "timer-stop") stopTimer();
});

// priority pickers
["taskPriority", "recPriority"].forEach(pickerId => {
  document.getElementById(pickerId).addEventListener("click", e => {
    const btn = e.target.closest(".pri-btn");
    if (btn) setPriorityPicker(pickerId, btn.dataset.value);
  });
});

// weekday picker
document.getElementById("recWeekdays").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (btn) btn.classList.toggle("selected");
});

document.getElementById("recFreq").addEventListener("change", updateRecFreqUI);

// task images: paste anywhere in the task form, attach button, remove, lightbox
document.getElementById("taskModal").addEventListener("paste", e => {
  const files = [...(e.clipboardData ? e.clipboardData.items : [])]
    .filter(i => i.type.startsWith("image/"))
    .map(i => i.getAsFile())
    .filter(Boolean);
  if (!files.length) return;
  e.preventDefault();
  addModalImages(files);
});
document.getElementById("taskAttach").addEventListener("click", () => document.getElementById("taskAttachFile").click());
document.getElementById("taskAttachFile").addEventListener("change", e => {
  addModalImages([...e.target.files]);
  e.target.value = "";
});
document.getElementById("taskImages").addEventListener("click", e => {
  const x = e.target.closest(".thumb-x");
  if (x) {
    modalImages.splice(+x.dataset.i, 1);
    renderModalImages();
  }
});
document.body.addEventListener("click", e => {
  const img = e.target.closest(".task-img");
  if (img) {
    document.getElementById("imgModalImg").src = img.src;
    document.getElementById("imgModal").hidden = false;
  }
});
document.getElementById("imgModal").addEventListener("click", () => {
  document.getElementById("imgModal").hidden = true;
});

// task form
document.getElementById("btnAddTask").addEventListener("click", () => openTaskModal(null));
document.getElementById("taskCancel").addEventListener("click", closeModals);
document.getElementById("taskForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("taskId").value;
  const data = {
    title: document.getElementById("taskTitle").value.trim(),
    priority: getPriorityPicker("taskPriority"),
    due: document.getElementById("taskDue").value,
    time: document.getElementById("taskTime").value,
    notes: document.getElementById("taskNotes").value.trim(),
    images: modalImages.slice(),
  };
  if (!data.title || !data.due) return;
  if (id) {
    const t = state.tasks.find(x => x.id === id);
    Object.assign(t, data);
  } else {
    const dupe = openTasks().find(t => normTitle(t.title) === normTitle(data.title));
    if (dupe && !confirm(`"${dupe.title}" is already on your list (due ${friendlyDate(dupe.due)}). Add this as a separate task anyway?`)) return;
    state.tasks.push({ id: uid(), ...data, createdAt: new Date().toISOString(), completedAt: null });
  }
  save(); closeModals(); renderAll();
});
document.getElementById("taskDelete").addEventListener("click", () => {
  const id = document.getElementById("taskId").value;
  if (id && confirm("Delete this task? This can't be undone.")) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    save(); closeModals(); renderAll();
  }
});

// recurring form
document.getElementById("btnAddRecurring").addEventListener("click", () => openRecModal(null));
document.getElementById("recCancel").addEventListener("click", closeModals);
document.getElementById("recForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("recId").value;
  const freq = document.getElementById("recFreq").value;
  const weekdays = Array.from(document.querySelectorAll("#recWeekdays button.selected")).map(b => Number(b.dataset.day));
  if (freq === "weekly" && weekdays.length === 0) {
    alert("Pick at least one day of the week.");
    return;
  }
  const data = {
    title: document.getElementById("recTitle").value.trim(),
    priority: getPriorityPicker("recPriority"),
    freq,
    weekdays: freq === "weekly" ? weekdays : [],
    monthday: freq === "monthly" ? Math.min(31, Math.max(1, Number(document.getElementById("recMonthday").value) || 1)) : null,
    notes: document.getElementById("recNotes").value.trim(),
  };
  if (!data.title) return;
  if (id) {
    const r = state.recurring.find(x => x.id === id);
    Object.assign(r, data);
  } else {
    const dupe = state.recurring.find(r => normTitle(r.title) === normTitle(data.title));
    if (dupe && !confirm(`"${dupe.title}" already exists as a recurring task (${recWhenLabel(dupe)}). Add this as a separate one anyway?`)) return;
    state.recurring.push({ id: uid(), ...data });
  }
  save(); closeModals(); renderAll();
});
document.getElementById("recDelete").addEventListener("click", () => {
  const id = document.getElementById("recId").value;
  if (id && confirm("Delete this recurring task? Its completion history will also be removed.")) {
    state.recurring = state.recurring.filter(r => r.id !== id);
    Object.keys(state.recurringDone).forEach(k => { if (k.startsWith(id + "|")) delete state.recurringDone[k]; });
    save(); closeModals(); renderAll();
  }
});

// milestone form
document.getElementById("btnAddMilestone").addEventListener("click", () => openMilestoneModal(null));
document.getElementById("msCancel").addEventListener("click", closeModals);
document.getElementById("msForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("msId").value;
  const data = {
    title: document.getElementById("msTitle").value.trim(),
    date: document.getElementById("msDate").value,
    notes: document.getElementById("msNotes").value.trim(),
  };
  if (!data.title || !data.date) return;
  if (id) Object.assign(state.milestones.find(x => x.id === id), data);
  else state.milestones.push({ id: uid(), ...data });
  save(); closeModals(); renderMilestones();
});
document.getElementById("msDelete").addEventListener("click", () => {
  const id = document.getElementById("msId").value;
  if (id && confirm("Delete this milestone?")) {
    state.milestones = state.milestones.filter(m => m.id !== id);
    save(); closeModals(); renderMilestones();
  }
});

// calendar connect form
document.getElementById("calCancel").addEventListener("click", closeModals);
document.getElementById("calForm").addEventListener("submit", e => {
  e.preventDefault();
  const url = document.getElementById("calUrl").value.trim();
  if (!url) return;
  state.icsUrl = url;
  save(); closeModals();
  icsEvents = []; icsError = null; icsFetchedAt = null;
  renderMeetings();
  fetchMeetings(true);
});
document.getElementById("calDisconnect").addEventListener("click", () => {
  state.icsUrl = "";
  icsEvents = []; icsError = null; icsFetchedAt = null;
  localStorage.removeItem(ICS_CACHE_KEY);
  save(); closeModals(); renderMeetings();
});

// focus timer
document.getElementById("timerPresets").addEventListener("click", e => {
  const btn = e.target.closest(".pri-btn");
  if (!btn) return;
  document.querySelectorAll("#timerPresets .pri-btn").forEach(b => b.classList.toggle("selected", b === btn));
  document.getElementById("timerCustom").value = "";
});
document.getElementById("timerCancel").addEventListener("click", closeModals);
document.getElementById("timerStart").addEventListener("click", () => {
  const custom = parseInt(document.getElementById("timerCustom").value, 10);
  const preset = document.querySelector("#timerPresets .pri-btn.selected");
  const minutes = custom > 0 ? Math.min(240, custom) : (preset ? +preset.dataset.min : 25);
  const title = document.getElementById("timerTaskName").textContent;
  closeModals();
  startTimer(title, minutes);
});

// day modal
document.getElementById("dayClose").addEventListener("click", closeModals);
document.getElementById("dayAddTask").addEventListener("click", () => {
  const d = selectedDay;
  closeModals();
  openTaskModal(null, d);
});

// close modal on backdrop click / Escape
document.querySelectorAll(".modal-backdrop").forEach(bd => {
  bd.addEventListener("click", e => { if (e.target === bd) closeModals(); });
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModals(); });

// calendar nav
document.getElementById("calPrev").addEventListener("click", () => {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1);
  renderCalendar();
});
document.getElementById("calToday").addEventListener("click", () => {
  calCursor = startOfMonth(new Date());
  renderCalendar();
});

// export / import
document.getElementById("btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "task-planner-backup-" + todayStr() + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById("btnImport").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.tasks) || !Array.isArray(data.recurring)) throw new Error("bad format");
      if (confirm("Import this backup? It will replace your current tasks.")) {
        state = {
          tasks: data.tasks, recurring: data.recurring, recurringDone: data.recurringDone || {},
          milestones: data.milestones || [], icsUrl: data.icsUrl || "",
          seeded: true, seededV2: true, seededV3: true, dedupedV1: true,
        };
        save(); renderAll(); fetchMeetings(true);
      }
    } catch {
      alert("Sorry, that file doesn't look like a valid backup.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

// refresh "today" automatically if the tab stays open past midnight
let lastDay = todayStr();
setInterval(() => {
  if (todayStr() !== lastDay) {
    lastDay = todayStr();
    renderAll();
  }
}, 60000);

// meetings: show cached copy instantly, then refresh now and every 30 min
loadMeetingsFromCache();
renderAll();
fetchMeetings(false);
setInterval(() => fetchMeetings(true), 30 * 60000);
