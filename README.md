# Bae Sik Dang / 배식당

A retro Korean BBQ restaurant website preview, with a teal storefront sign,
golden brickwork, aged cream posters, and red Korean and English lettering.

Serve this directory with `python3 -m http.server 8000` and open `index.html`.
The restaurant page uses Tailwind and optional Google Fonts from CDNs. Core
styles, display fonts, textures, and the generated BBQ image are bundled.
`styles.css` includes the display-font licenses. All pages work without the
external CDNs. Use the same HTTP origin to share saved reservations between pages.

## Reservations

- Choose a date from today through seven days ahead, inclusive, in Singapore time.
- Dinner slots are 18:00, 19:30, and 21:00. Past slots cannot be saved.
- Private Room, Main Lobby, and Room 3 currently use identical layouts: two
  six-seat tables and two four-seat tables, for 20 seats per room.
- Select whole tables or individual seats across multiple tables. One reservation
  covers one room, date, and time. Each room and time has separate availability.
- Add a guest name, optional phone number, and optional special requests using
  sample details. New customer bookings await staff confirmation; they hold their
  selected seats. Customer edits return a booking to awaiting confirmation.
- `reservations.html` lists locally saved bookings. Edit links reopen the planner
  with the original selection. Saving updates that same record.
- Cancellation asks which specific booking to cancel, confirms the action, and
  releases its seats. Cancelled records remain viewable in a separate tab.
- `reservation-store.js` validates dates, seats, availability, and record revisions
  on every write. Web Locks serialize writes between tabs where available.
- `reservation-ui.js` renders the accessible 3D-style tables and management board.
- Reservations use browser storage only. Blocked storage prevents saving, with a
  visible error. No reservation, cancellation, or change is sent to the restaurant.

## Menu, FAQ, and other interactions

The menu includes illustrative ingredients, allergens, and prices. Lighting
preferences complete the restaurant preview.
Reduced-motion preferences pause continuous animations by default.

The FAQ has seven demo answers, search, category filters, question matching,
recent-question history, and reversible helpful/not-helpful votes. Questions
without a match remain unsent and can be downloaded as text. FAQ history and
feedback are local to the visitor's browser, with an in-memory fallback when
storage is unavailable. There are no aggregate visitor counts or staff replies.

Demo information must be replaced with confirmed restaurant policies before
connecting any real booking or messaging service.

## Staff preview

Open `admin.html`, or use **Staff preview** in the restaurant footer or booking
section. This adapts the supplied staff-page files to the same retro theme.

- Choose a day and dinner time to see all three rooms, available tables, guest
  names, contact details, and clearly labelled confirmation status.
- Open **Details** to confirm a pending request, edit the guest/date/time/room/
  exact seats, or cancel with a confirmation step. Cancelled bookings remain in
  the day's expandable history. Edits keep the original booking reference.
- **New booking** walks staff through a phone/walk-in booking and saves it as
  confirmed. Staff can use a slot already underway today. The preview uses
  90-minute dinner slots; this is not an established restaurant policy.
- **Load sample bookings** adds three labelled examples without replacing any
  reservations. Clicking again does not duplicate those examples.
- **Print this day's list** provides a simple guest list with confirmation status.

This is a demo without authentication or a backend. Customer and staff pages
share local storage only on the same browser and origin, including updates
between tabs. A different staff device cannot receive customer bookings. No
notifications are sent. Use sample personal details. Existing saved bookings
remain readable; blocked storage and stale edits show errors.

## Vercel

Use `main` as the production branch and the repository root (`.`) as the Root
Directory. `vercel.json` configures static hosting without install or build steps.
`index.html` is the homepage. `/portfolio.html` redirects to `/`.
