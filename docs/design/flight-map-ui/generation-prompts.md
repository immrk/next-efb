# Image generation prompts

## 01 — Waypoint symbol system

```text
Use case: ui-mockup
Asset type: aviation map waypoint icon system design board for NextEFB
Primary request: Create a polished, production-ready visual design sheet showing an original family of aviation map symbols and waypoint icons for a modern electronic flight bag. This is a UI system board, not concept art.
Scene/backdrop: deep graphite-navy interface background (#10151D) with subtle square grid, clean generous spacing, no map scenery.
Subject: a coherent set of crisp vector-like map symbols arranged in a disciplined grid. Include visually distinct symbols for: major airport, regional airport, heliport, VOR, VOR-DME, DME, NDB, enroute intersection/fix, RNAV waypoint, user waypoint, departure, destination, alternate airport, fly-by waypoint, fly-over waypoint, holding fix, missed-approach point, aircraft position. Show three interaction states for representative symbols: default, route-included, selected/active. Show small practical size samples at 16 px, 20 px, 24 px and a few map-label pairings such as ZSPD, SASAN, DUMET, HSN, PUD.
Style/medium: high-fidelity shippable product UI; flat vector-like aviation symbology; technically precise geometry; sharp edges; consistent 1.5–2 px strokes; modern professional EFB aesthetic inspired by best-in-class aviation planning software while remaining fully original.
Composition/framing: 16:9 landscape design system board, category groups aligned to an 8 px grid, large enough symbols to inspect, a compact palette strip and state legend at the bottom.
Color palette: base text #E8EEF7, muted #7C8A9E, airport cyan #4CC9F0, navaid blue #4D8DFF, fix white #DDE6F3, user point amber #FFB84D, planned route violet #C975FF, active leg cyan #39D4FF, departure mint #4DDBA5, destination coral #FF6B7A. Selected symbols use a restrained luminous ring, never neon glow overload.
Materials/textures: clean glassy UI only in tiny panels; icons themselves must stay flat and legible over a map.
Text: use short uppercase aviation identifiers only. Render these identifiers verbatim: "ZSPD", "SASAN", "DUMET", "HSN", "PUD", "VOR", "NDB", "WPT", "APT".
Constraints: icons must remain readable at tiny map scale; no decorative illustration; no 3D; no skeuomorphism; no brand logos; no trademarks; no watermark; do not imitate any single existing product exactly. Symbols must be distinct by shape as well as color. Avoid excessive labels or dense paragraphs.
Avoid: generic location pins, emoji, circular dots for every type, huge glow, gradients inside icons, fake mobile phone frames, presentation mockup held by hands.
```

## 02 — Waypoint information components

```text
Use case: ui-mockup
Asset type: waypoint information cards and interaction states design board for NextEFB aviation map
Primary request: Create a polished, production-ready design board for how waypoint and route information appears over a modern electronic flight bag map. Show a coherent family of overlays, compact labels, popovers, and selected-state panels. This is a practical UI specification sheet, not concept art.
Scene/backdrop: dark desaturated aviation map fragment on graphite navy (#10151D), with faint coastlines, airways, range rings, and a restrained violet route passing through a few fixes. Keep the map quiet so cards remain readable.
Subject: show six clearly separated UI examples: 1) tiny always-visible waypoint label, 2) hover tooltip for SASAN, 3) selected enroute fix detail card for DUMET, 4) airport detail card for ZSPD, 5) route leg information pill between SASAN and DUMET, 6) altitude and speed constraint chips attached to a waypoint. Include a small bottom-sheet style card for touch/tablet use. Use visually distinct vector-like symbols consistent with a premium aviation map: star-like enroute fix, diamond RNAV waypoint, octagonal VOR, airport symbol, amber user point.
Information hierarchy: large identifier first, type and full name second, then operational data in aligned rows. For DUMET show "DUMET", "RNAV WAYPOINT", coordinates "31°18.6'N 121°42.3'E", magnetic variation "VAR 5°W". For ZSPD show "ZSPD", "SHANGHAI PUDONG INTL", elevation "13 FT", runways "16L / 34R" and weather chip "VFR". For the route leg pill show "042°M", "28 NM", "ETE 07 MIN". For constraint chips show "FL120+" and "250 KT". Include action buttons labelled "ADD TO ROUTE", "DIRECT TO", "CENTER", and a three-dot overflow icon.
Style/medium: high-fidelity shippable desktop and tablet product UI; original best-in-class EFB aesthetic; compact professional typography; layered translucent panels with subtle background blur and hairline borders; crisp vector-like map icons; no marketing illustration.
Composition/framing: 16:9 landscape design board, cards arranged around a central map excerpt and connected to their anchor points with subtle leader lines. Show default, hover, selected, and route-active states without clutter. Use an 8 px spacing system and consistent 10–12 px corner radii.
Color palette: panel #151C26 at 94% opacity, primary text #F1F5FA, secondary #8E9CB0, hairline #2A3647, route violet #C975FF, active leg cyan #39D4FF, selection ring cyan #4CC9F0, warning/constraint amber #FFB84D, departure mint #4DDBA5, destination coral #FF6B7A. Use #0682F5 as the NextEFB action blue.
Text: render all provided aviation identifiers and values verbatim. Typography resembles Inter plus a compact technical mono for headings, courses, distances, and coordinates.
Constraints: all cards must feel implementable in React/CSS; strong information hierarchy; readable at a glance; avoid oversized cards; no brand logos except the plain word "NextEFB" in a small title; no trademarks; no watermark; do not copy any single existing app exactly.
Avoid: generic consumer map pins, glassmorphism blur overload, huge glowing neon, skeuomorphism, 3D, fake device hands, decorative charts, excessive paragraphs, illegible tiny text.
```

## 03 — Full flight-planning map

```text
Use case: ui-mockup
Asset type: full desktop electronic flight bag flight-planning map screen for NextEFB
Primary request: Create a high-fidelity, shippable desktop UI mockup for an original modern aviation flight-planning map. Redesign the map markers, route line, waypoint labels, selected waypoint details, and flight-plan editor so the product feels mature and professional rather than a demo.
Scene/backdrop: full-screen dark operations map of eastern and southern China, graphite-navy terrain and coastlines, subtle airspace boundaries, sparse airway network, restrained range rings. The map is information-rich but calm.
Subject: a flight route from ZSPD Shanghai Pudong to ZGGG Guangzhou Baiyun. Show fixes SASAN, DUMET, HSN, PUD, DAGMO with distinct crisp vector-like icons. Major airports use a clear airport symbol, VORs use octagonal ring symbols, enroute fixes use four-point stars, RNAV waypoints use diamonds, user points use amber triangles. A selected DUMET fix has a cyan selection ring and a compact anchored detail popover.
Route visual design: the overall planned route uses a wide very-dark halo underneath a crisp 3 px violet line (#C975FF); the current active leg is cyan (#39D4FF) with a subtle directional arrowhead and brighter leading edge; completed leg is muted violet at lower opacity; SID/STAR terminal segments are mint and coral accents; expected ATC vector legs are short dashed lines with open arrowheads; a holding pattern near one fix uses a clean racetrack shape. Add restrained course/distance chips along two segments such as "182°M · 46 NM" and "217°M · 62 NM". Attach amber constraint chips "FL120+" and "250 KT" to one waypoint. Labels must have dark halo/backplate for map contrast and never collide with symbols.
Layout: slim 64 px left navigation rail with plain NextEFB mark and simple line icons; 360 px flight plan inspector panel open beside it; large map fills the rest. Floating top map toolbar for search, layer controls APT/AWY/VOR/NDB/WPT, weather and map style. Small right-side zoom/recenter controls. Compact bottom flight metrics bar.
Flight plan inspector: header "FLIGHT PLAN" with route summary "ZSPD → ZGGG" and "IFR · FL330". Structured departure card with runway "16L" and SID "SASAN 3D"; a vertical editable waypoint list for SASAN, DUMET, HSN, PUD, DAGMO with drag handles, segment distance and altitude; arrival card with STAR and ILS runway "02L". Include buttons "OPTIMIZE", "SAVE", and a strong blue primary action "FLY ROUTE". Show summary metrics "764 NM", "01:58", "5.8 T".
Selected waypoint popover: "DUMET", "RNAV WAYPOINT", coordinates, "NEXT HSN · 62 NM", buttons "DIRECT TO" and "MORE".
Style/medium: realistic high-fidelity product UI screenshot, original premium EFB aesthetic inspired by modern aviation planning tools without copying any exact layout or trademark. Compact Inter-style typography, tabular technical numbers, crisp 1 px dividers, 8 px spacing system, 10–12 px corner radii, restrained translucent panels.
Composition/framing: 16:9 landscape, straight-on desktop application view, no device frame. The route is the dominant visual focus and remains clearly visible behind UI.
Color palette: app background #0F141C, panel #151C26, elevated #1B2430, text #F1F5FA, muted #8290A4, border #2A3647, NextEFB action blue #0682F5, route violet #C975FF, active cyan #39D4FF, departure mint #4DDBA5, destination coral #FF6B7A, constraint amber #FFB84D.
Text: render the supplied uppercase aviation identifiers and concise UI labels verbatim. Avoid unnecessary text.
Constraints: practical implementable React/CSS layout; excellent hierarchy; icons readable at map scale; route has clear z-order and dark casing; selected state is obvious but not glowy; no brand logos other than plain word NextEFB; no trademarks; no watermark; do not reproduce Navigraph or ForeFlight exactly.
Avoid: generic consumer map design, bright street-map colors, circular dots for all nav types, thick cartoon route, excessive glass blur, giant gradients, neon cyberpunk, 3D, concept art, fake hardware frame, hands, illegible tiny paragraphs.
```
