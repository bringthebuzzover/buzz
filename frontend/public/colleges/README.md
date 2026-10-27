# College logos

Local marks for the college network strip (`src/data/colleges.ts`). Nothing here loads from a remote logo host.

Each file's source page on Wikimedia Commons, original URL, licence and processing are in `sources.json`. Names are `<slug>.svg`, or `<slug>.png` at most 256px. The Ivy, MIT, UChicago, Michigan and Vanderbilt marks are older imports in `src/assets/unis/`.

To add a school: put its logo here, record it in `sources.json`, and set `logoSrc` in `src/data/colleges.ts`.
