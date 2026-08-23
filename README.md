# QWBS Golden Dataset Toolkit

A **Google Apps Script** toolkit that turns a Google Sheet into a working WBS
(Work Breakdown Structure) *golden-dataset* workbench: a dynamic multi-filter
dashboard for reviewing roles across plants, plus one-click file-to-Drive
attachment straight from a row.

Built to help a consulting team curate the **best WBS entry per designation**
across 10–15 plants/companies — but the engine is generic and works for any
"master table + filtered dashboard + attach a file per row" use case.

---

## Features

- **Dynamic dashboard filter** — pick any one (or several) of **Company /
  Plant Location / Department / Designation** and instantly see every matching
  row across all plants. Leave a filter blank to mean "all."
- **Blank-until-selected** — the results area stays empty until at least one
  filter is chosen, so the dashboard opens clean.
- **Select all / Clear all** — per-filter and all-filters actions from a
  custom menu.
- **Multi-value tolerant matching** — token-based matching, so a cell like
  `GCC, Intratek` still matches a `GCC` filter (works with Google Sheets
  native multi-select dropdowns).
- **Layout-aware** — result columns are mapped by header keyword and the match
  count is located by its label, so the engine keeps working even when the
  dashboard columns are rearranged.
- **Drive upload from a row** — select a row, pick a file; it's uploaded to a
  configured Drive folder and the shareable link is written back into the row.
- **Self-healing dropdowns** — a helper re-applies all data-validation
  dropdowns from a central `Lists` tab if an import ever strips them.

## How it works

| Piece | Role |
|---|---|
| `Master Data Entry` tab | the source table (one row per designation/plant entry) |
| `Dashboard View` tab | filter cells + a results area the script fills |
| `Lists` tab | single source of truth for every dropdown |
| `Code.gs` | menu, filter engine, Drive upload, setup helpers |
| `Upload.html` | the file-picker dialog for uploads |

The filter engine reads the four filter cells, keeps rows where every
*non-blank* filter matches (token overlap), and writes the results into the
dashboard columns it locates by header keyword — writing the live match count
next to the "Matches found" label. A simple `onEdit` trigger refreshes it
automatically whenever a filter or the master data changes.

## Repository structure

```
.
├── src/
│   ├── Code.gs        # all server-side logic (menu, filter, upload, setup)
│   └── Upload.html    # client dialog for the Drive upload
├── docs/
│   └── SETUP.md       # step-by-step install & usage
├── .gitignore
├── LICENSE
└── README.md
```

## Quick start

1. Create a Google Sheet with tabs: `Master Data Entry`, `Dashboard View`,
   `Lists` (and optionally `QWBS Criteria`).
2. Open **Extensions ▸ Apps Script**, paste `src/Code.gs` into `Code.gs`, and
   add an HTML file named `Upload` with the contents of `src/Upload.html`.
3. Reload the sheet — a **QWBS Tools** menu appears.
4. Run **QWBS Tools ▸ Re-apply dropdowns**, then **Set Drive folder…**.

Full instructions, including the multi-select toggle and the filter-cell
layout, are in [`docs/SETUP.md`](docs/SETUP.md).

## Tech

Google Apps Script (V8) · Google Sheets · Google Drive · HTML Service.

## Author

**Rudra Ashis Mishra** — data & automation.

## License

Released under the [MIT License](LICENSE).

> **Privacy note:** this repository ships only the reusable tooling and a
> sanitized template. No real organizational data, consultant names, sheet
> IDs, or Drive folder IDs are included — and none should be committed.
