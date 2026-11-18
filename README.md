# OoT Bingo Stats

A GitHub Pages site for exploring historical Ocarina of Time Bingo race data, player statistics, item statistics, and head-to-head comparisons.

**Live site:** https://runnerguy2489.github.io/bingo-test/

## Site pages

| Page | Description |
| --- | --- |
| [Monthly Races](index.html) | Monthly race counts |
| [Overall Stats](overall_stats.html) | Aggregate race statistics |
| [Overall Player Stats](overall_player_stats.html) | Career statistics for players |
| [Overall Item Stats](overall_itemstats.html) | Board appearances, picks, and item performance |
| [Player Profile](player_profile.html) | Individual player history and performance |
| [Head-to-Head](head_to_head.html) | Compare two players |

The six HTML pages remain in the repository root so their current GitHub Pages URLs do not change.

## Repository structure

```text
.
├── index.html
├── overall_stats.html
├── overall_player_stats.html
├── overall_itemstats.html
├── player_profile.html
├── head_to_head.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js
│       ├── head_to_head.js
│       ├── overall_stats.js
│       ├── overall_player_stats.js
│       ├── overall_item_stats.js
│       └── player_profile.js
├── data/
│   └── JSON datasets used by the site
├── scripts/
│   └── Python data-generation scripts
└── docs/
    └── Project documentation
```

## Data files

The site loads its published JSON datasets from `data/`: monthly race counts, overall statistics, overall player statistics, overall item statistics, player profile data, player race data, and head-to-head data.

The source file `bingo_races_filtered.json` is an input to the generators and is not currently tracked in the repository. Put it in `data/` before regenerating the derived datasets.

## Regenerating data

Run commands from the repository root. The scripts now resolve their default input and output files relative to the repository's `data/` folder, rather than relying on the terminal's current working directory.

```bash
python scripts/generate_monthly_counts.py
python scripts/generate_overall_stats.py
python scripts/generate_overall_player_stats.py
python scripts/generate_overall_item_stats.py
python scripts/generate_player_profile_stats.py
python scripts/generate_player_race_data.py
python scripts/build_head_to_head.py
```

The scripts that accept custom input/output arguments continue to support them. Check each script's argument definitions for the exact syntax.

After regenerating, review the JSON changes and commit the updated files in `data/`.

## Where to make changes

- HTML page structure and navigation: repository root
- Shared styling: `assets/css/styles.css`
- Browser behavior: matching file in `assets/js/`
- Published JSON and source race JSON: `data/`
- Data-generation code: `scripts/`
- Longer notes and data definitions: `docs/`

Because HTML pages remain at the root, browser data requests use paths such as `data/overall_item_stats.json`, even though the requesting JavaScript file is stored under `assets/js/`.
