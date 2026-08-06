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
        seeded: !!data.seeded,
      };
    }
  } catch (e) { /* fall through to fresh state */ }
  return { tasks: [], recurring: [], recurringDone: {}, seeded: false };
}

function seedIfNeeded() {
  if (state.seeded) return;
  const existing = new Set(state.tasks.map(t => t.title.trim().toLowerCase()));
  SEED_TASKS.forEach(s => {
    if (!existing.has(s.title.trim().toLowerCase())) {
      state.tasks.push({ id: uid(), time: "", ...s, createdAt: new Date().toISOString(), completedAt: null });
    }
  });
  state.seeded = true;
  save();
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
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
  renderCalendar();
  renderAllTasks();
  renderRecurring();
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
    </div>
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

  // Coming up: next 7 days
  const week = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const ds = dateToStr(d);
    sortTasks(open.filter(t => t.due === ds)).forEach(t => week.push(t));
  }
  if (week.length) {
    sections.push(sectionHTML("📆 Coming up this week", week.map(t => taskCardHTML(t)).join(""), week.length));
  }

  if (!sections.length) {
    sections.push(`<div class="empty-note">No tasks yet. Click <strong>+ Add Task</strong> to get started, or add your repetitive tasks under <strong>🔁 Recurring</strong>.</div>`);
  }

  document.getElementById("todaySections").innerHTML = sections.join("");
}

function sectionHTML(title, body, count) {
  return `<div class="today-section"><h3>${title} <span class="section-count">${count}</span></h3>${body}</div>`;
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
    html += e.type === "task" ? taskCardHTML(e.t, { showCompletedDate: false }) : recCardHTML(e.rec, e.date);
  }
  el.innerHTML = html;
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

function openTaskModal(task, prefillDate) {
  document.getElementById("taskModalTitle").textContent = task ? "Edit Task" : "Add Task";
  document.getElementById("taskId").value = task ? task.id : "";
  document.getElementById("taskTitle").value = task ? task.title : "";
  document.getElementById("taskDue").value = task ? task.due : (prefillDate || todayStr());
  document.getElementById("taskTime").value = task ? (task.time || "") : "";
  document.getElementById("taskNotes").value = task ? (task.notes || "") : "";
  setPriorityPicker("taskPriority", task ? task.priority : "high");
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

function closeModals() {
  document.getElementById("taskModal").hidden = true;
  document.getElementById("recModal").hidden = true;
  document.getElementById("dayModal").hidden = true;
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
  };
  if (!data.title || !data.due) return;
  if (id) {
    const t = state.tasks.find(x => x.id === id);
    Object.assign(t, data);
  } else {
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
        state = { tasks: data.tasks, recurring: data.recurring, recurringDone: data.recurringDone || {}, seeded: true };
        save(); renderAll();
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

renderAll();
