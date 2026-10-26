# Bae Sik Dang / 배식당

A single-file retro Korean BBQ restaurant website preview. The design combines
Bae Sik Dang's Korean and English name, a teal storefront sign, golden
brickwork, aged cream posters, and red lettering.

Open `index.html` in a modern browser, or serve this directory with
`python3 -m http.server 8000`. Tailwind and optional Google Fonts use external
CDNs. The generated BBQ photograph, textures, display fonts, core CSS, and
interactions are embedded in the HTML. Font license notices are included.
The core experience works even when external CDNs are unavailable.

## Features

- Menu details with illustrative ingredients, allergens, and prices.
- A local table-picker demo that filters seats by party size.
- Ambient lighting preferences and a pausable kitchen simulation.
- A themed FAQ board with six seeded demo answers, search, and category filters.
- Questions matched to existing FAQ answers, with up to eight recent questions.
- Questions without a match remain unsent and can be downloaded as a text file.
- Reversible helpful/not-helpful votes, with one local selection per answer.

FAQ history and feedback are stored only in the visitor's browser. Visitors can
clear their history, change a vote, or remove it by selecting it again. When
storage is unavailable, interactions remain usable for the current tab session.
There are no aggregate visitor counts or staff replies, and nothing is submitted
to the restaurant. Demo answers must be reviewed and replaced with confirmed
restaurant policies before a real booking service is connected.

Bookings, menu prices, and kitchen updates are demonstrations. Reduced-motion
preferences pause the animated kitchen by default.

## Vercel

Use `main` as the production branch and the repository root (`.`) as the Root
Directory. `vercel.json` configures a static deployment without an install or
build step and uses `.` as the output directory.

The homepage is served from `index.html`. `/portfolio.html` redirects to `/`.
