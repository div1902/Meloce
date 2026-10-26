# MELOCE

A single-file retro Korean BBQ restaurant concept, branded MELOCE / 메로체.
The design combines a teal storefront sign, textured golden brickwork,
aged cream menu posters, and red Korean and English lettering.

Open `index.html` in a modern browser, or serve this directory with
`python3 -m http.server 8000`. Tailwind and Google Fonts use external CDNs;
the generated BBQ photograph, SVG artwork, textures, display fonts, core styles,
and interactions are embedded in the HTML. Embedded font license notices are
included at the end of the file. The core experience also works if
external CDNs are unavailable, using local font fallbacks.

## Vercel

Import this repository using `main` as the production branch and the repository
root (`.`) as the Root Directory. `vercel.json` configures a static deployment
with no install or build step and `.` as the output directory.

The homepage is served from `index.html`. The former `/portfolio.html` URL
redirects to `/`.

The menu includes ingredient and allergen dialogs. The table picker filters
seats by party size, and the lighting controls retain a local visual preference.
The table bookings and kitchen orders are local demonstrations, not backend
services. Prices and menu information are illustrative; no real reservation is
submitted. Reduced-motion preferences pause the animated kitchen by default.
