# Design Alignment Plan: Booking App ↔ cinematicsitesofsavannah.com

Status: Proposed (awaiting implementation)
Date: 2026-06-12

## Goal

This booking app is an extension of the existing marketing site at
https://cinematicsitesofsavannah.com/ (WordPress + Divi 4.27.6). Users land here
from that site to book tours, then pay real money. The two properties must feel
like the same product so the checkout experience is trustworthy. The target is
visual parity with the marketing site — same fonts, exact colors, same header
and footer chrome, same button language — implemented in this app's modern
stack (React Router v7, Tailwind CSS v4, shadcn on Base UI).

This document contains everything needed to implement without re-inspecting the
live site: extracted design tokens, asset URLs, current-state file references,
and per-task acceptance criteria.

## Source-of-Truth Design Tokens (extracted from the live site's CSS)

### Fonts

The site self-hosts two custom OTF fonts via Divi's font uploader:

| Font | File URL | Usage on site |
|---|---|---|
| CA Negroni (Light) | `https://cinematicsitesofsavannah.com/wp-content/uploads/et-fonts/CANegroni-Light.otf` | ALL headings h1–h6, main nav links, hero CTA button text. Always in stack `'CA Negroni',Helvetica,Arial,Lucida,sans-serif` |
| Ants Valley | `https://cinematicsitesofsavannah.com/wp-content/uploads/et-fonts/Ants-Valley.otf` | Display/script accents only: hero H1 (75px desktop / 60px mobile, weight 500), "About" H3 (60px, color #f47b51) |

Body font is Open Sans (already self-hosted in this app via
`@fontsource-variable/open-sans`).

Licensing note: CA Negroni and Ants Valley are commercial typefaces. The
business already licenses and hosts them on the marketing site; self-hosting
the same files here is almost certainly fine, but confirm the license covers a
second domain before shipping.

### Colors

| Hex | Site role |
|---|---|
| `#80cfd3` (teal, Divi accent color) | All heading text (h1–h6), body links, nav hover, button-hover background, footer widget headings. **Missing from the app entirely.** |
| `#92cdd2` (lighter teal) | Dropdown submenu background, mobile menu background |
| `#00354c` (dark navy) | Main nav link color, footer background |
| `#13344a` (navy variant) | Submenu / mobile-menu link color |
| `#466b83` (slate blue) | Submenu current-menu-item link color |
| `#f47b51` (terracotta) | Hero CTA button fill, "About" display heading |
| `#82c0c7` (muted teal) | Footer widget link hover |
| `#bababa` | CTA button border |
| `#000000` | Body text color (site overrides Divi default #666 to black); header bottom border |
| `#ffffff` | Page background, header menu bar background, footer link/text color, button text |

### Typography scale (site customizer values)

- Body: Open Sans, **20px**, color `#000000`, line-height 1.4em
- Headings: CA Negroni, color `#80cfd3`, weight 500
- Nav links: CA Negroni, weight 600, **24px** (22px at smaller breakpoints), uppercase, color `#00354c`, hover `#80cfd3`, `transition: color 300ms ease`
- Hero CTA button text: CA Negroni, weight 600, 24px (20px responsive), letter-spacing 1px

### Button (site CTA, e.g. "BROWSE TOURS")

```css
/* extracted from .et_pb_button_0 rules */
color: #ffffff;
background-color: #f47b51;
border: 1px solid #bababa;
border-radius: 40px;            /* pill */
letter-spacing: 1px;
font-family: 'CA Negroni', Helvetica, Arial, Lucida, sans-serif;
font-weight: 600;
font-size: 24px;                /* 20px responsive */
padding: 6px 20px;
transition: color 300ms ease, background-color 300ms ease;
/* hover */
background-color: #80cfd3;
color: #000000;
```

### Header structure (site, Divi Theme Builder)

- Sticky section, full width, padding `0 80px`, **2px solid #000000 bottom border**
- Section background: repeating film-strip GIF, `repeat-x`, `left top`:
  `https://cinematicsitesofsavannah.com/wp-content/uploads/2023/02/nav-banner-bkgrd1.gif`
- Logo: `https://cinematicsitesofsavannah.com/wp-content/uploads/2023/06/CSS-logo1.png`
  (391×340 natural), rendered **150px tall, width auto** (140px responsive),
  links to `https://cinematicsitesofsavannah.com/`
- Menu module sits on `#ffffff` background over the film-strip GIF; menu column
  `padding-top: 84px` desktop so links bottom-align next to the tall logo
- Nav links (exact labels and hrefs, including dropdowns):
  - Home → `https://cinematicsitesofsavannah.com/`
  - Tours → `https://cinematicsitesofsavannah.com/savannah-movie-tours/`
    - Tour Reviews → `https://cinematicsitesofsavannah.com/savannah-movie-tours/cinematic-sites-savannah-tour-reviews/`
  - What to Expect → `https://cinematicsitesofsavannah.com/what-to-expect/`
  - About → `https://cinematicsitesofsavannah.com/about/`
  - Our Crew → `https://cinematicsitesofsavannah.com/our-crew/`
    - Crew Call → `https://cinematicsitesofsavannah.com/our-crew/crew-call/`
    - Savannah's Supporting Cast → `https://cinematicsitesofsavannah.com/our-crew/savannahs-supporting-cast/`
    - Production Terminology → `https://cinematicsitesofsavannah.com/our-crew/production-terminology/`
    - Vendors → `https://cinematicsitesofsavannah.com/our-crew/vendors/`
  - FAQs → `https://cinematicsitesofsavannah.com/faqs/`
- Dropdown submenus: background `#92cdd2`, link color `#13344a`,
  current-item color `#466b83`, fade animation

### Footer structure (site, Divi Theme Builder)

Background `#00354c` navy. Content, top to bottom:

1. Footer logo, centered:
   `https://cinematicsitesofsavannah.com/wp-content/uploads/2023/06/CSS-logo-footer1.png` (401×331 natural)
2. Three 1/3 columns, white text/links:
   - Column 1 — nav links (Home, Tours, What to Expect, About, Our Crew, FAQs;
     same destinations as header, no dropdowns)
   - Column 2 — centered contact block:
     `Cinematic Sites of Savannah ®` / `Savannah, GA` / `912-644-0361` /
     `Email Us` → `mailto:info@cinematicsitesofsavannah.com`
   - Column 3 — `Office Hours:` / `Monday-Friday` / `8am-6pm`
3. Bottom bar, centered, white text:
   `© 2026 | All rights reserved. Site by Julie Garman Design.`
   ("Julie Garman Design" links to `http://www.juliegarmandesign.com`)

No social icons.

### Favicon

Site uses a dedicated cropped icon, not the full logo:
`https://cinematicsitesofsavannah.com/wp-content/uploads/2023/05/cropped-icon-32x32.png`
(also available at 192/180/270 sizes by substituting the dimensions in the
filename, e.g. `cropped-icon-192x192.png`).

## Current App State (what diverges)

- `app/app.css` — Tailwind v4 CSS-first theme. `--font-heading` aliases
  Open Sans; no CA Negroni / Ants Valley. Tokens are *close but not exact*
  oklch approximations: `--primary` ≈ #00354c, `--secondary` ≈ #92cdd2,
  `--accent` ≈ #f47b51. The signature heading/link teal `#80cfd3` does not
  exist anywhere. Also imports `@fontsource-variable/inter`, which is unused.
- `app/root.tsx` — preconnects/loads Inter from Google Fonts (lines ~15–26),
  redundant with self-hosted fonts. Favicon points at `public/favicon.ico`,
  which is a byte-for-byte copy of the full `logo.png`.
- `app/routes/layout.tsx` — header approximation: white bar, 2px black bottom
  border, plain `bg-secondary` teal stripe instead of the film-strip GIF. Nav
  is Open Sans `font-semibold text-2xl uppercase text-primary` (should be
  CA Negroni with teal hover). Label says "Faqs" (site: "FAQs"). "Our Crew"
  link has an **empty href**. No dropdown submenus. Logo hardcoded
  `h-[150px] w-[172px]`. **No footer exists in the app at all.**
- `app/components/ui/button.tsx` — shadcn CVA button: default variant is a
  small navy rectangle (`h-7`, `text-xs`, `rounded-md`). Nothing resembles the
  site's terracotta pill CTA.
- `app/routes/tour-booking.tsx` — main booking page. Uses ad-hoc `stone-*`
  grays and `text-xs`/`text-sm` type instead of theme tokens, and hardcodes
  `#D97757` (a *different* terracotta than the brand's `#f47b51`) for star
  ratings and checkmarks.
- `app/routes/checkout-success.tsx`, `app/routes/checkout-cancel.tsx`,
  `app/routes/manage-tour.tsx` — checkout/manage pages; mostly `stone-*` +
  token mix; same quiet gray aesthetic.
- Stepper components in `app/components/stepper/` (`index.tsx`,
  `date-selector.tsx`, `guest-selector.tsx`, `booker-details.tsx`,
  `booking-confirmation.tsx`) — primary CTA uses the small navy button style.

## Tasks (priority order)

Each task is independently implementable. Tasks 1 and 2 are prerequisites for
4 and 5.

### Task 1: Add brand fonts (CA Negroni + Ants Valley)

1. Download both OTFs from the URLs in the Fonts table above into
   `public/fonts/` (e.g. `public/fonts/CANegroni-Light.otf`,
   `public/fonts/Ants-Valley.otf`). Consider converting to woff2 for size
   (optional; OTF works in all modern browsers).
2. In `app/app.css`, add `@font-face` declarations with `font-display: swap`:
   - `font-family: "CA Negroni"` (the Light cut is the only weight the site
     uses; weights 500/600 on the site are synthesized — replicate by using the
     same `font-weight` values in CSS and letting the browser synthesize, which
     matches what the site renders)
   - `font-family: "Ants Valley"`
3. Update theme: `--font-heading: "CA Negroni", Helvetica, Arial, sans-serif;`
   and add `--font-display: "Ants Valley", cursive;` to `@theme inline`.
4. Add a base-layer rule applying `font-heading` to `h1–h6` (Divi applies it to
   all headings sitewide; mirror that, components can override).
5. Remove `@import "@fontsource-variable/inter";` from `app/app.css` and the
   Google Fonts Inter `<link>`/preconnect tags from `app/root.tsx` (unused).

Acceptance: headings across all routes render in CA Negroni; no Inter assets
are requested; `bun run typecheck` and `bun run build` pass.

### Task 2: Exact color token alignment

In `app/app.css` `:root`:

1. Set tokens to the exact site values (hex is fine in Tailwind v4, or
   exact-converted oklch):
   - `--primary: #00354c`
   - `--secondary: #92cdd2`
   - `--accent: #f47b51`
2. Add the missing signature teal as a first-class token, exposed through
   `@theme inline` so utilities like `text-brand-teal` work:
   - `--brand-teal: #80cfd3` (headings, links, hovers)
   - Optionally `--brand-teal-muted: #82c0c7` if footer link hover is built.
3. In `app/routes/tour-booking.tsx`, replace every hardcoded `#D97757` with the
   accent token (`text-accent` / `fill-accent` or `var(--accent)`).

Acceptance: `rg -i 'd97757'` returns nothing under `app/`; visual check that
star ratings/checkmarks now use #f47b51.

### Task 3: Build the footer

Create `app/components/footer.tsx` and render it in `app/routes/layout.tsx`
below `<Outlet />`. Replicate the site footer per the Footer structure section
above:

1. Download `CSS-logo-footer1.png` (URL above) to `public/logo-footer.png`.
2. `bg-[#00354c]` (or `bg-primary` once Task 2 lands) full-width footer; white
   text; links white with `hover:text-[#82c0c7]`.
3. Footer logo centered on top; then three columns (stack on mobile):
   nav links / contact block / office hours — exact copy from the Footer
   structure section, including the `®` and the phone as a `tel:` link.
4. Bottom copyright bar, centered:
   `© {currentYear} | All rights reserved. Site by Julie Garman Design.` with
   the external link.

Why this is priority: the app currently has **no footer**. A payment page with
no business identity (phone, location, email) reads as untrustworthy. This is
the highest trust-per-effort change.

Acceptance: footer renders on all routes (it lives in the shared layout);
columns stack sensibly below `md`; all links resolve.

### Task 4: Header parity

In `app/routes/layout.tsx` (depends on Tasks 1–2):

1. Replace the plain teal stripe (`<div className='absolute w-full top-0 bg-secondary h-6 -z-10' />`)
   with the film-strip treatment. Two options:
   - Faithful: download `nav-banner-bkgrd1.gif` (URL above) to
     `public/nav-banner.png` (convert GIF→PNG, it is not animated) and use
     `bg-[url(/nav-banner.png)] bg-repeat-x bg-left-top` on the header section,
     with the menu/logo row on a white background above it — mirroring the
     Divi structure where the white menu bar sits over the strip.
   - Modernized (preferred if the GIF is low-res): recreate the film-strip
     sprocket-hole pattern as an inline SVG/CSS pattern using `#000` on the
     existing teal. Keep the same visual height.
2. Nav links: switch to `font-heading` (CA Negroni), keep 24px uppercase
   `text-primary`, add `hover:text-[#80cfd3]` (or `hover:text-brand-teal`)
   with `transition-colors duration-300`.
3. Fix label `Faqs` → `FAQs`.
4. Fix the empty "Our Crew" href → `https://cinematicsitesofsavannah.com/our-crew/`.
5. Add dropdown submenus for Tours and Our Crew (links in the Header structure
   section). Use the existing Base UI primitives (project has @base-ui/react);
   submenu panel `bg-[#92cdd2]`, links `text-[#13344a]`, fade-in. Per the
   project animation guidelines: ease-out, fast (~200ms), origin-aware
   (`transform-origin: top`).
6. Logo: drop the hardcoded `w-[172px]` (391×340 source distorts slightly);
   use `h-[150px] w-auto` and wrap in a link to
   `https://cinematicsitesofsavannah.com/`. Use responsive `h-[140px]` below
   ~1100px if matching the site's responsive rule.
7. Note: nav links are external (back to the WP site), so plain `<a>` tags are
   more appropriate than React Router `<Link>` — current code uses `<Link>`
   with absolute URLs, which works but `<a>` is cleaner. Also the current
   markup nests `<Link>` directly inside `<ul>` without `<li>` — fix while
   here.

Acceptance: side-by-side screenshot comparison with the live site header looks
equivalent at 1440px and 390px widths; hover states animate color over 300ms.

### Task 5: Site-style CTA button variant

In `app/components/ui/button.tsx` (depends on Tasks 1–2):

1. Add a `cta` variant to the CVA config matching the site button spec (see
   Button token block above): pill (`rounded-full`), `bg-accent text-white`,
   `border border-[#bababa]`, `font-heading font-semibold tracking-wide`,
   `hover:bg-[#80cfd3] hover:text-black`,
   `transition-[color,background-color] duration-300`.
2. Add a larger size (site CTA is 24px text with 6px/20px padding; a modern
   equivalent is fine, e.g. `h-11 px-5 text-lg` with font-heading).
3. Apply the `cta` variant to primary forward-action CTAs: the stepper's
   continue/confirm buttons (`app/components/stepper/*.tsx`) and the
   checkout/manage primary actions. Keep existing small variants for
   utilitarian in-form controls (time-slot pills, +/- steppers).

Acceptance: the main booking CTA visually matches the site's "BROWSE TOURS"
button (pill, terracotta, CA Negroni, teal hover).

### Task 6: Typography scale and neutrals cleanup

Sweep `app/routes/tour-booking.tsx`, `checkout-success.tsx`,
`checkout-cancel.tsx`, `manage-tour.tsx`, and `app/components/stepper/*`:

1. Replace `stone-*` utilities with theme tokens:
   `text-stone-500/600` → `text-muted-foreground`, `border-stone-200` →
   `border-border`, `bg-stone-50` → `bg-muted`.
2. Raise base copy from `text-xs`/`text-sm` toward 16px (`text-base`) for body
   copy and form labels. Deliberate deviation: the site uses 20px body text,
   but 20px is too large for a form-dense booking UI; 16px is the modernized
   compromise. Keep `text-sm` minimum for form helper text.
3. Headings on these pages should pick up CA Negroni automatically from Task 1;
   verify sizes still look balanced and adjust per-page heading sizes if
   needed. Where a heading is the page's main title, consider site heading
   color `#80cfd3` — but use judgment: on white backgrounds over small text it
   can look washed out; navy `text-primary` headings with teal reserved for
   larger display headings is an acceptable modernization. Document whichever
   choice is made.

Acceptance: `rg 'stone-' app/` returns nothing (or only justified remnants);
no body copy below `text-sm`.

### Task 7: Housekeeping

1. Favicon: download `cropped-icon-32x32.png` (URL above; also grab the
   192px size) into `public/`, update the `<link rel="icon">` in
   `app/root.tsx`, and stop using the full-logo `favicon.ico`.
2. Verify no remaining references to Inter anywhere
   (`rg -i inter app/ package.json`); remove `@fontsource-variable/inter` from
   `package.json` dependencies.

## Verification (all tasks)

- `bun run typecheck`
- `bun run build`
- Manual visual diff against https://cinematicsitesofsavannah.com/ at desktop
  (1440px) and mobile (390px): header, footer, buttons, heading typography.
- Booking flow smoke test: `/tour/:tourId` → stepper → checkout pages render
  correctly with new styles.

## Out of Scope

- No changes to booking logic, Convex functions, payment flow, or routes.
- No dark mode work (the `.dark` block in `app.css` stays as-is).
- No changes to the marketing site itself.
- Hero/homepage sections of the marketing site (Ants Valley 75px hero, etc.)
  are reference material only — this app has no homepage hero.
