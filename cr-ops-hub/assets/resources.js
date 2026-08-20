/* ============================================================
   THE ONE FILE YOU EDIT
   ------------------------------------------------------------
   Everything the Ops Hub shows lives in this list. To change
   the hub, edit this file, save, commit. The live site updates
   itself within about a minute.

   To add a resource, copy an existing block and change it:

     {
       name:  'What it is called on the card',
       blurb: 'One line explaining it.',
       href:  'https://link-to-the-thing',
       cta:   'OPEN SHEET',        // the little red link text
       tags:  ['search', 'words'], // extra search terms, optional
     }

   To mark something as not ready yet, use  status: 'soon'
   and leave out href. It renders greyed out and unclickable.

   To take a card down, delete its block (or add  hidden: true).
   ============================================================ */

window.CR_RESOURCES = [

  /* ---------------------------------------------------------
     Row 1 — the live sites. These render as the dark cards.
     --------------------------------------------------------- */
  {
    label: 'Live now',
    title: 'Operations Sites',
    featured: true,
    items: [
      {
        name: 'Agent Referral Directory',
        emphasis: 'Directory',
        kicker: 'Coverage map',
        blurb: 'Referral agents by county, with coverage gaps called out in red.',
        href: 'agents-directory/',
        cta: 'OPEN DIRECTORY',
        tags: ['agents', 'county', 'coverage', 'gaps', 'referral', 'blake', 'howard', 'short sale', 'spanish'],
      },
      {
        name: 'Agent Referral Leads',
        emphasis: 'Leads',
        kicker: 'Lead sheets',
        blurb: 'One lead sheet per agent partner. Straight through to their Google Sheet.',
        href: 'referral-leads/',
        cta: 'OPEN LEAD SHEETS',
        tags: ['leads', 'sheets', 'partners', 'google sheets', 'referral'],
      },
      {
        name: 'CR Leads Dashboard',
        emphasis: 'Dashboard',
        kicker: 'Pipeline',
        blurb: 'Live lead and pipeline tracking for the CR team.',
        href: 'https://crleadsdashboard.netlify.app/',
        external: true,
        cta: 'OPEN DASHBOARD',
        tags: ['dashboard', 'pipeline', 'leads', 'tracking', 'kpi'],
      },
    ],
  },

  /* ---------------------------------------------------------
     Row 2 — KPIs & scorecards. Drop your Sheet links in here.
     --------------------------------------------------------- */
  {
    label: 'Performance',
    title: 'KPIs & Scorecards',
    items: [
      {
        name: 'Ops Scorecard',
        blurb: 'Weekly operations metrics and targets.',
        status: 'soon',
        cta: 'OPEN SHEET',
        tags: ['scorecard', 'kpi', 'metrics', 'weekly'],
      },
      {
        name: 'Lead Tracker',
        blurb: 'Inbound lead volume and source performance.',
        status: 'soon',
        cta: 'OPEN SHEET',
        tags: ['leads', 'tracker', 'sources'],
      },
      {
        name: 'Deal Flow Report',
        blurb: 'Contracts, closings, and fallout by month.',
        status: 'soon',
        cta: 'OPEN SHEET',
        tags: ['deals', 'closings', 'contracts', 'fallout'],
      },
    ],
  },

  /* ---------------------------------------------------------
     Row 3 — SOPs & handbooks.
     --------------------------------------------------------- */
  {
    label: 'Playbooks',
    title: 'SOPs & Handbooks',
    items: [
      {
        name: 'Acquisitions Handbook',
        blurb: 'Leads, underwriting, offers, and contract.',
        status: 'soon',
        cta: 'OPEN HANDBOOK',
        tags: ['acquisitions', 'acq', 'underwriting', 'offers', 'contract'],
      },
      {
        name: 'Dispo Handbook',
        blurb: 'Buyers list, assignment process, marketing.',
        status: 'soon',
        cta: 'OPEN HANDBOOK',
        tags: ['dispo', 'disposition', 'buyers', 'assignment', 'marketing'],
      },
      {
        name: 'TC SOP',
        blurb: 'Transaction coordinator standard operating procedures.',
        status: 'soon',
        cta: 'OPEN SOP',
        tags: ['tc', 'transaction coordinator', 'sop', 'closing'],
      },
      {
        name: 'Onboarding Checklist',
        blurb: 'Day-one setup for a new hire: accounts, access, training.',
        status: 'soon',
        cta: 'OPEN CHECKLIST',
        tags: ['onboarding', 'new hire', 'checklist', 'access', 'training'],
      },
    ],
  },

  /* ---------------------------------------------------------
     Row 4 — internal tools & generators.
     --------------------------------------------------------- */
  {
    label: 'Internal tools',
    title: 'Tools & Generators',
    items: [
      {
        name: 'Seller Objection Handler',
        blurb: 'Post-contract objection scripts and rebuttals.',
        status: 'soon',
        cta: 'LAUNCH TOOL',
        tags: ['objection', 'seller', 'scripts', 'rebuttal'],
      },
      {
        name: 'Seller Weekly Update Generator',
        blurb: 'Weekly seller update emails in seconds.',
        status: 'soon',
        cta: 'LAUNCH TOOL',
        tags: ['weekly update', 'seller', 'email', 'generator'],
      },
      {
        name: 'Dispo Listing Generator',
        blurb: 'Raw AM notes into subject lines, listings, and buyer emails.',
        status: 'soon',
        cta: 'LAUNCH TOOL',
        tags: ['dispo', 'listing', 'generator', 'buyer email', 'subject line'],
      },
    ],
  },

];
