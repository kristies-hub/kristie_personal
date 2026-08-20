# Leads Dashboard — folder reserved

Right now the hub links straight out to the existing Netlify site:
<https://crleadsdashboard.netlify.app/>

I couldn't copy that site's HTML into this repo because the machine I was
working on can't reach `netlify.app`. Bringing it in-house is a two-minute job
whenever you want to:

## Moving it in

1. Open <https://crleadsdashboard.netlify.app/>, right-click → **View Page Source**,
   select all, copy. (Or download it from Netlify: **Deploys → the live deploy →
   Download** the deploy files.)
2. Save it in this folder as `index.html`.
3. In `assets/resources.js`, find the **CR Leads Dashboard** block and change:

   ```js
   href: 'https://crleadsdashboard.netlify.app/',
   external: true,
   ```

   to:

   ```js
   href: 'leads-dashboard/',
   ```

   (delete the `external: true` line — it's only for links that leave the hub)
4. Commit. The dashboard is now served from this repo like the other two, and the
   old Netlify site can be deleted.

## Watch for

If that dashboard pulls data from anywhere — a Google Sheet, an API, a Netlify
function, a `_redirects` proxy — copying the HTML alone won't bring that along.
Check for a `_redirects` file or a `netlify/functions` folder in the Netlify
deploy before you retire the old site.
