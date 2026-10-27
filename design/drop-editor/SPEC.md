# BUZZ drop editor: design handoff

Source of truth: `mock/dark.html` (open it directly; `?mode=brand`, `?pop=1`, `?edit=1`, `?desc=1` switch states).
pen.dev design: `drop-editor.pen` (pen.dev 1.2.x; references `images/` and `fonts/` next to it).
Renders (2x): `renders/*.png`. pen.dev HTML exports: `export/` (reference only, not production code).

## Tokens

| Token | Value | Use |
|---|---|---|
| ink | `#0b0b0b` | page background, text on yellow |
| paper | `#f0f0f0` | primary text |
| y | `#f6d32a` | accent: primary buttons, selected, today ring |
| y-fade | `#f6d32a` at 14% (`#f6d32a24`) | hover, selected preset, date range band |
| mut / faint | paper at 52% / 30% | secondary / tertiary text |
| line | paper at 9% | hairline borders and dividers |
| s1 / s2 | paper at 4% / 8% | row/card surfaces, pills |
| card / pop | `#121212` / `#161616` | preview card, popover |

- Font: **Switzer** 400/500 (`fonts/`); fall back to Inter, then system-ui.
- Dark by default. No light theme in scope.
- Spacing scale: 4/8 px (4, 8, 12, 16, 24, 32, 40). Radii: 8 (rows, cards), 999 (pills, chips, buttons).
- **Hover = faded yellow** (`y-fade` background) on rows, presets, chips, and calendar days. Selected = solid `y` with `ink` text.

## Frames

1. **Admin · Drop editor** (`renders/1-admin-drop-editor.png`)
   - Top bar: BUZZ logo, breadcrumb "Drops / New drop", "Draft saved" status dot, avatar.
   - Drop type segmented control: Product drop / Event activation / Content only.
   - Title "Yerba Madre x BUZZ" (68px, the "x" dimmed to faint), chips "+ Short summary" and brand chip.
   - Sections: 01 Campuses (campus chips with logo + remove, "+ Add campus"), 02 Application window (Apply opens / Apply closes rows: GMT-4, date pill, time pill, "ET" hint), 03 Details (Description, What you're sending, Location, Campaign hashtag; value + arrow), 04 Reach (Organizations, Units per org, Unit budget with "/ unit"), 05 Settings (Show in org drop feed toggle, Brand can edit details toggle, Stage = Draft).
   - Right column: "How orgs will see it" live preview card (cover photo, "Applications open Nov 2" badge, Replace cover, brand line, title, description, Campuses/Spots/Closes, Apply) + "Save drop" CTA + "Autosaves as you go. Publishing moves it to Open."
2. **Brand · Request a drop** (`renders/2-brand-request.png`), brand mode (`?mode=brand`)
   - Breadcrumb "Dashboard / Request a drop"; third segment is "Not sure yet".
   - Section 02 is "Preferred timing"; Reach hint "Ballpark is fine".
   - Settings is removed (admin-only); adds "06 Anything else?" free-text field.
   - CTA "Send request"; note "Buzz reviews it and reaches out within a few days."
3. **Admin · Date range open** (`renders/3-admin-date-range-open.png`, component `renders/component-date-range-popover.png`)
   - Opens from the Application window rows, anchored over section 02.
   - Left: Quick pick presets (Starts today, This week, Next 2 weeks (selected, y-fade), This month, Custom).
   - Header: prev/next month buttons, "Today, Oct 27" chip with yellow dot (expected to jump back to today).
   - Two months (October / November 2026). Past days dimmed. **Today (Oct 27, 2026)**: yellow 1.5px ring around the day number plus a "TODAY" label on its own line under it; every day cell has the same size (44x48: 36px band + 12px label line) so the label never crowds neighbours.
   - Range Nov 2 → Nov 13: ends are solid yellow dots, days between get the y-fade band, rounded at week-row ends.
   - Footer: "OPENS Mon, Nov 2 [9:00 AM] → CLOSES Fri, Nov 13 [11:59 PM]" on the left; "Clear" and "Apply · 12 days" on the right.
4. **Admin · Drop name edit** (`renders/4-admin-name-edit.png`, `?edit=1`)
   - Clicking the title turns it into an inline field: y-fade 7% fill, yellow 45% outline, radius 8, yellow caret.
   - Hint below: "✎ Click to rename · Default is [Brand] x BUZZ" and a "Reset to default" link (yellow, underlined).

## States and behaviour

- **Admin vs brand mode**: same layout; brand hides admin-only parts (Settings, Save drop) and shows brand-only copy (frame 2).
- **Default name**: `[Brand] x BUZZ` (e.g. "Yerba Madre x BUZZ"), "x" rendered dimmed. Renaming overrides it; "Reset to default" restores it.
- **Date popover**: presets set the range; clicking a day sets the start, then the end; "Apply · N days" commits to the Apply opens/closes rows; "Clear" empties the range.
- **Today** is always marked (ring + TODAY label), even when it falls outside the selected range.
- **Details rows** open an editor (the mock's `?desc=1` shows the Description modal: rich text toolbar, "Shown on the drop card: first line only", 212 / 600 counter, Cancel / Save).
- **Reach**: tap a number to edit (focused stat gets a yellow outline).
- Preview card updates live from the form.
- Do not add features beyond the mock.

## Notes for implementation

- The pen.dev HTML exports were post-processed (`box-sizing: content-box` → `border-box`), because the exporter's content-box output overflowed rows. They are good for measurements, but write the real components by hand (React/Tailwind) using the tokens above.
- All example values (brand, campuses, counts, dates) are mock data.
