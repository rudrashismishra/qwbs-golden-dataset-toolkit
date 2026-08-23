# QWBS Golden Dataset — Google Sheets Setup (multi-select + filter + Drive upload)

You'll import the workbook to Google Sheets once, paste one script, turn on
multi-select for the columns you want, and set a Drive folder. ~10 minutes.

Files you need:
- `QWBS_Golden_Dataset_Master_SHEETS.xlsx`  (the workbook, with your data & lists)
- `QWBS_AppsScript_Code.gs`                  (the script)
- `QWBS_AppsScript_Upload.html`              (the upload dialog)

---

## Part A — Import the workbook to Google Sheets

1. Go to **drive.google.com**, open the folder you want this in.
2. **New ▸ File upload** ▸ choose `QWBS_Golden_Dataset_Master_SHEETS.xlsx`.
3. Right-click it ▸ **Open with ▸ Google Sheets**.
4. **File ▸ Save as Google Sheets** (makes a native Sheet). You can delete the
   uploaded .xlsx copy afterwards.
   - All four tabs, your Lists, the criteria list, and the single-select
     dropdowns come across.

## Part B — Add the script

1. **Extensions ▸ Apps Script**.
2. Select everything in `Code.gs`, delete it, and paste the whole contents of
   **`QWBS_AppsScript_Code.gs`**.
3. Click **+ ▸ HTML**, name it exactly **`Upload`**, delete its contents, paste
   the whole contents of **`QWBS_AppsScript_Upload.html`**.
4. **Save** (💾), close the Apps Script tab, and **reload the Sheet**. A
   **"QWBS Tools"** menu appears.
5. If any dropdown looks missing after import, run **QWBS Tools ▸ Re-apply
   dropdowns**. (Authorize when asked — Advanced ▸ Go to project ▸ Allow.)

## Part C — Turn on multi-select for the fields you want

Google Sheets multi-select is a per-column toggle (it can't be scripted, but
it's two clicks). For **each** column below:

1. Select the column's data cells (e.g. **F5:F238** for Designation).
2. **Data ▸ Data validation ▸** click the existing rule.
3. Set **Criteria = Dropdown (from a range)** if not already, then turn on
   **"Allow multiple selections"** ▸ **Done**.

Columns and their source ranges (already wired — you're just flipping the
multi toggle):

| Column on Master        | Cells      | Source (Lists tab)      |
|-------------------------|------------|-------------------------|
| Company (A)             | A5:A238    | Lists!B3:B22            |
| Plant Location (B)      | B5:B238    | Lists!C3:C33            |
| Section/ Department (C) | C5:C238    | Lists!D3:D364           |
| Designation (F)         | F5:F238    | Lists!E3:E16            |
| QWBS Criteria (I)       | I5:I238    | 'QWBS Criteria'!B3:B12  |

And on the **Filter View** tab, do the same three so you can filter on several
values at once: **C3** (Company), **E3** (Department), **G3** (Designation).

> Equipment Type is left as free text — add a list on the Lists tab and wire it
> the same way if you want it as a dropdown too.

## Part D — Point the upload at a Drive folder

1. Create/choose a Drive folder for uploaded files; copy its **folder ID**
   (the part of the URL after `/folders/`).
2. In the Sheet: **QWBS Tools ▸ Set Drive folder…**, paste the ID, OK.

---

## How you'll use it

**Enter data:** on the Master tab, pick values from the dropdowns. Where
multi-select is on, tick several values — they store as `GCC, Intratek` etc.
For QWBS Criteria, tick every criterion that applies (names come from the
*QWBS Criteria* tab).

**Filter across plants:** on the **Filter View** tab, choose any mix in
Company / Department / Designation (each can hold several values). Results
refresh automatically; or run **QWBS Tools ▸ Refresh filter**. A Master cell
holding several values still matches — e.g. a row with Company `GCC, Intratek`
appears when you filter Company = `GCC`. "Matches found" shows the count.

**Attach a file:** select a row ▸ **QWBS Tools ▸ Upload file to current row** ▸
pick the file. It uploads to your Drive folder and the link lands in column H.

---

## Notes

- **Why the filter is script-driven now:** with multi-value cells, a plain
  formula can't reliably tell "does this cell share any value with the filter".
  The script does exact token matching in code, which is robust and fast.
- **Auto-refresh:** editing a filter cell, or any Master row, re-runs the
  filter. If it ever looks stale, click **Refresh filter**.
- **Sharing of uploaded files** defaults to *anyone with the link – viewer*;
  change the `setSharing` line in `Code.gs` if your Workspace requires stricter.
- **If you rename a tab or move the Link column**, update the constants at the
  top of `Code.gs` (`MASTER`, `FILTER`, `LINK_COL`).
