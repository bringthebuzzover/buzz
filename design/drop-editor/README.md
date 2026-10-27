# Drop editor design files

- `drop-editor.pen`: pen.dev source (open with this folder as the working directory; it reads `images/` and `fonts/`).
- `SPEC.md`: handoff spec (tokens, frames, behaviour).
- `renders/`: 2x PNG renders of the four frames and the date range popover.
- `fonts/` is a symlink to the self-hosted Switzer files in `frontend/src/pages/pulse/fonts/`, so no font files are duplicated.

In this repo the spec's `mock/dark.html` lives at `frontend/lab-static/drop-editor/` (served at `/lab/drop-editor/`).
The React build is `frontend/src/pages/drop-editor/`, served at `/drop-editor` (`?mode=brand`, `?pop=1`, `?edit=1`, `?desc=1`).
