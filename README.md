# MELOCE

A single-file interactive portfolio for premium restaurant digital experiences.

Open `index.html` in a modern browser, or serve this directory with
`python3 -m http.server 8000`. Tailwind and Google Fonts use external CDNs;
the artwork, core styles, and interactions are embedded in the HTML.

## Vercel

Import this repository using `main` as the production branch and the repository
root (`.`) as the Root Directory. `vercel.json` configures a static deployment
with no install or build step and `.` as the output directory.

The homepage is served from `index.html`. The former `/portfolio.html` URL
redirects to `/`.

The table bookings and kitchen orders are local demonstrations, not backend
services. The project brief downloads locally without submitting its contents.
