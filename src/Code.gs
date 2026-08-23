/*************************************************************************
 * QWBS Golden Dataset — Google Sheets automation
 *
 * Dashboard View — pick ANY ONE filter to see that role across ALL plants.
 * Leave a filter blank to mean 'all'. Dropdown values come from the 'Lists'
 * tab — keep that tab updated. Results refresh automatically.
 *
 *   1) Drive upload  : upload a file to Drive, drop the link in column H
 *   2) Filter engine : reads the Dashboard View selections and lists matching
 *                       Master rows. FOUR filters: Company, Plant Location,
 *                       Department, Designation. Multi-value tolerant.
 *                       ** Results stay BLANK until at least one filter is set.
 *                          A blank filter (while another is set) means "all". **
 *   3) Select/Clear  : per-filter and all-filters "Select all" / "Clear all"
 *                       via the QWBS Tools > Filters menu.
 *   4) Setup helper   : re-applies the dropdowns if an import dropped them.
 *************************************************************************/

var MASTER      = 'Master Data Entry';
var FILTER      = 'Dashboard View';
var LINK_COL    = 8;     // H = QWBS File / Drive Link (on Master)
var MASTER_HDR  = 4;     // Master header row; data starts row 5
var MASTER_COLS = 11;    // Master columns A..K
var DASH_HDR    = 5;     // Dashboard result header row
var RES_START   = 6;     // Dashboard first result row
var DASH_FILTER_ROW = 3; // Dashboard row holding the filter cells (and labels)
var PROP_FOLDER = 'QWBS_DRIVE_FOLDER_ID';

// Where the live match count is written. Leave '' to auto-detect the cell to
// the RIGHT of the "Matches found" label (searched across the top rows). If
// auto-detect ever misses, set this to the exact cell, e.g. 'M3'.
var MATCHES_CELL = '';

/* ---- THE FOUR FILTERS — single source of truth --------------------------
 * cell      = the filter value cell on the Dashboard View
 * label     = name shown in menus
 * masterCol = which Master column it filters (1-based: A=1 ... K=11)
 * list      = the dropdown source range (used for dropdowns + "Select all")
 * Company=A(1), Plant Location=B(2), Section/Department=C(3), Designation=F(6)
 */
var FILTER_CELLS = [
  { cell: 'C3', label: 'Company',        masterCol: 1, list: 'Lists!B3:B22'  },
  { cell: 'E3', label: 'Plant Location', masterCol: 2, list: 'Lists!C3:C33'  },
  { cell: 'G3', label: 'Department',     masterCol: 3, list: 'Lists!D3:D364' },
  { cell: 'I3', label: 'Designation',    masterCol: 6, list: 'Lists!E3:E16'  }
];

/* ---------------------------------------------------------------- menu */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  var filtersMenu = ui.createMenu('Filters')
    .addItem('Select ALL in every filter', 'selectAllFilters')
    .addItem('Clear ALL filters', 'clearAllFilters')
    .addSeparator()
    .addItem('Company — Select all', 'selCompany').addItem('Company — Clear', 'clrCompany')
    .addItem('Plant Location — Select all', 'selPlant').addItem('Plant Location — Clear', 'clrPlant')
    .addItem('Department — Select all', 'selDept').addItem('Department — Clear', 'clrDept')
    .addItem('Designation — Select all', 'selDesig').addItem('Designation — Clear', 'clrDesig');

  ui.createMenu('QWBS Tools')
    .addItem('Refresh filter', 'refreshFilter')
    .addSubMenu(filtersMenu)
    .addSeparator()
    .addItem('Upload file to current row', 'showUploadDialog')
    .addItem('Set Drive folder…', 'setDriveFolder')
    .addSeparator()
    .addItem('Re-apply dropdowns (if lost on import)', 'setupDropdowns')
    .addToUi();
}

/* --------------------------------------------------------- small utils */
function norm(v) {
  return String(v === null || v === undefined ? '' : v)
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
function labelKey(v) { return norm(v).replace(/:$/, ''); }
function tokens(v) {
  if (v === null || v === undefined) return [];
  return String(v).split(',').map(function (s) { return s.trim().toLowerCase(); })
                  .filter(function (s) { return s !== ''; });
}
function matchField(cellValue, filterToks) {
  if (filterToks.length === 0) return true;                 // blank filter = all
  var cellToks = tokens(cellValue);
  for (var i = 0; i < filterToks.length; i++) {
    if (cellToks.indexOf(filterToks[i]) > -1) return true;  // any overlap
  }
  return false;
}

/* ----------------------------------------------------------- filtering */
function refreshFilter() {
  var ss = SpreadsheetApp.getActive();
  var m = ss.getSheetByName(MASTER), f = ss.getSheetByName(FILTER);
  if (!m || !f) {
    SpreadsheetApp.getUi().alert('Cannot find a tab named "' + MASTER + '" and "' + FILTER +
      '". Check the tab names / the MASTER and FILTER values at the top of the script.');
    return;
  }

  // read the four filter selections
  var filters = FILTER_CELLS.map(function (fc) {
    return { mi: fc.masterCol - 1, toks: tokens(f.getRange(fc.cell).getValue()) };
  });
  var anySelected = filters.some(function (x) { return x.toks.length > 0; });

  // Master data (A..K fixed)
  var mLast = m.getLastRow();
  var data  = mLast > MASTER_HDR
      ? m.getRange(MASTER_HDR + 1, 1, mLast - MASTER_HDR, MASTER_COLS).getValues()
      : [];

  // map each Master field -> Dashboard result column by header keyword
  var FIELD_KEYWORDS = ['company', 'plant', 'section', 'sub', 'description',
                        'designation', 'equipment', 'drive', 'criteria', 'score', 'verified'];
  var dLastCol = Math.max(f.getLastColumn(), MASTER_COLS + 4);
  var dHead = f.getRange(DASH_HDR, 1, 1, dLastCol).getValues()[0].map(norm);
  function findColByKeyword(kw) {
    for (var c = 0; c < dHead.length; c++) if (dHead[c].indexOf(kw) > -1) return c + 1;
    return 0;
  }
  var snoCol = 0;
  for (var c = 0; c < dHead.length; c++) {
    if (dHead[c].indexOf('s.no') > -1 || dHead[c].indexOf('sno') > -1) { snoCol = c + 1; break; }
  }
  var fieldCols = [];
  for (var j = 0; j < MASTER_COLS; j++) fieldCols[j] = findColByKeyword(FIELD_KEYWORDS[j]);

  // filter rows — BUT show nothing at all if no filter is selected
  var out = [];
  if (anySelected) {
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row.join('').toString().trim() === '') continue;    // skip blank rows
      var ok = true;
      for (var k = 0; k < filters.length; k++) {
        if (!matchField(row[filters[k].mi], filters[k].toks)) { ok = false; break; }
      }
      if (ok) out.push(row);
    }
  }

  // write results into the mapped columns (clear the whole result area first)
  var maxCol = snoCol || 1;
  for (var j = 0; j < MASTER_COLS; j++) if (fieldCols[j] > maxCol) maxCol = fieldCols[j];

  var clearRows = f.getMaxRows() - RES_START + 1;
  if (clearRows > 0) f.getRange(RES_START, 1, clearRows, f.getMaxColumns()).clearContent();

  if (out.length) {
    var grid = [];
    for (var i = 0; i < out.length; i++) {
      var arr = [];
      for (var c = 0; c < maxCol; c++) arr.push('');
      if (snoCol) arr[snoCol - 1] = i + 1;
      for (var j = 0; j < MASTER_COLS; j++) if (fieldCols[j]) arr[fieldCols[j] - 1] = out[i][j];
      grid.push(arr);
    }
    f.getRange(RES_START, 1, out.length, maxCol).setValues(grid);
  }

  // update the live match count
  writeMatchCount(f, dLastCol, out.length);
}

/** Writes the match count either to MATCHES_CELL (if set) or to the cell to
 *  the RIGHT of a "Matches found" label found anywhere in the top rows. */
function writeMatchCount(f, dLastCol, count) {
  if (MATCHES_CELL) { f.getRange(MATCHES_CELL).setValue(count); return; }
  var top = f.getRange(1, 1, DASH_HDR, dLastCol).getValues();
  for (var r = 0; r < top.length; r++) {
    for (var c = 0; c < top[r].length; c++) {
      if (labelKey(top[r][c]).indexOf('matches found') > -1) {
        f.getRange(r + 1, c + 2).setValue(count);   // value cell is to the right
        return;
      }
    }
  }
}

/** Auto-refresh when a filter cell (Dashboard rows 1-5) or Master data changes. */
function onEdit(e) {
  try {
    var sh = e.range.getSheet().getName();
    if (sh === FILTER) {
      if (e.range.getRow() <= DASH_HDR) refreshFilter();
    } else if (sh === MASTER) {
      refreshFilter();
    }
  } catch (err) { /* keep edits fast/safe */ }
}

/* -------------------------------------------- Select all / Clear all */
function listValues(rangeA1) {
  var vals = SpreadsheetApp.getActive().getRange(rangeA1).getValues();
  var seen = {}, out = [];
  for (var i = 0; i < vals.length; i++) {
    var v = String(vals[i][0] === null || vals[i][0] === undefined ? '' : vals[i][0]).trim();
    if (v !== '' && !seen[v.toLowerCase()]) { seen[v.toLowerCase()] = 1; out.push(v); }
  }
  return out;
}
function setFilterCell(idx, mode) {
  var f = SpreadsheetApp.getActive().getSheetByName(FILTER);
  var fc = FILTER_CELLS[idx];
  f.getRange(fc.cell).setValue(mode === 'all' ? listValues(fc.list).join(', ') : '');
}
function selectAllFilters() {
  for (var i = 0; i < FILTER_CELLS.length; i++) setFilterCell(i, 'all');
  refreshFilter();
}
function clearAllFilters() {
  for (var i = 0; i < FILTER_CELLS.length; i++) setFilterCell(i, 'clear');
  refreshFilter();
}
function selCompany() { setFilterCell(0, 'all');   refreshFilter(); }
function clrCompany() { setFilterCell(0, 'clear'); refreshFilter(); }
function selPlant()   { setFilterCell(1, 'all');   refreshFilter(); }
function clrPlant()   { setFilterCell(1, 'clear'); refreshFilter(); }
function selDept()    { setFilterCell(2, 'all');   refreshFilter(); }
function clrDept()    { setFilterCell(2, 'clear'); refreshFilter(); }
function selDesig()   { setFilterCell(3, 'all');   refreshFilter(); }
function clrDesig()   { setFilterCell(3, 'clear'); refreshFilter(); }

/* -------------------------------------------------------- drive upload */
function setDriveFolder() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Set Drive folder',
    'Paste the Google Drive FOLDER ID for uploaded files (the part of the folder URL after /folders/).',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var id = res.getResponseText().trim();
  if (!id) { ui.alert('No folder ID entered.'); return; }
  try {
    var name = DriveApp.getFolderById(id).getName();
    PropertiesService.getDocumentProperties().setProperty(PROP_FOLDER, id);
    ui.alert('Drive folder set to: "' + name + '".');
  } catch (e) { ui.alert('Could not open that folder:\n' + e); }
}

function showUploadDialog() {
  var ss = SpreadsheetApp.getActive(), sheet = ss.getActiveSheet(), ui = SpreadsheetApp.getUi();
  if (sheet.getName() !== MASTER) { ui.alert('Select a row on the "' + MASTER + '" tab first.'); return; }
  var row = sheet.getActiveCell().getRow();
  if (row <= MASTER_HDR) { ui.alert('Select a data row (row ' + (MASTER_HDR + 1) + ' or below).'); return; }
  if (!PropertiesService.getDocumentProperties().getProperty(PROP_FOLDER)) {
    ui.alert('Set a Drive folder first:  QWBS Tools > Set Drive folder…'); return;
  }
  var t = HtmlService.createTemplateFromFile('Upload'); t.row = row;
  ui.showModalDialog(t.evaluate().setWidth(420).setHeight(230), 'Upload file for row ' + row);
}

function uploadFile(payload) {
  var folderId = PropertiesService.getDocumentProperties().getProperty(PROP_FOLDER);
  if (!folderId) throw new Error('No Drive folder set.');
  var folder = DriveApp.getFolderById(folderId);
  var blob = Utilities.newBlob(payload.bytes, payload.mimeType, payload.name);
  var file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  var url = file.getUrl();
  SpreadsheetApp.getActive().getSheetByName(MASTER).getRange(payload.row, LINK_COL).setValue(url);
  return url;
}

/* --------------------------------------------- re-apply dropdowns base */
/* Single-select validations. After running this, turn ON "Allow multiple
   selections" per column in the UI (Data > Data validation) to get multi. */
function setupDropdowns() {
  var ss = SpreadsheetApp.getActive();
  var m = ss.getSheetByName(MASTER), f = ss.getSheetByName(FILTER);
  var lists = ss.getSheetByName('Lists'), crit = ss.getSheetByName('QWBS Criteria');
  var n = 1000;
  function rangeRule(srcRange) {
    return SpreadsheetApp.newDataValidation().requireValueInRange(srcRange, true)
             .setAllowInvalid(true).build();
  }
  var company = lists.getRange('B3:B22'), plant = lists.getRange('C3:C33'),
      dept = lists.getRange('D3:D364'), desig = lists.getRange('E3:E16'),
      score = lists.getRange('G3:G12'), criteria = crit.getRange('B3:B12');

  // Master entry columns
  m.getRange('A5:A' + n).setDataValidation(rangeRule(company));
  m.getRange('B5:B' + n).setDataValidation(rangeRule(plant));
  m.getRange('C5:C' + n).setDataValidation(rangeRule(dept));
  m.getRange('F5:F' + n).setDataValidation(rangeRule(desig));
  m.getRange('I5:I' + n).setDataValidation(rangeRule(criteria));
  m.getRange('J5:J' + n).setDataValidation(rangeRule(score));

  // Dashboard filter cells: Company C3, Plant Location E3, Department G3, Designation I3
  f.getRange('C3').setDataValidation(rangeRule(company));
  f.getRange('E3').setDataValidation(rangeRule(plant));
  f.getRange('G3').setDataValidation(rangeRule(dept));
  f.getRange('I3').setDataValidation(rangeRule(desig));
  SpreadsheetApp.getUi().alert('Dropdowns applied to Company (C3), Plant Location (E3), Department (G3), Designation (I3). ' +
    'Turn on "Allow multiple selections" per cell in Data > Data validation if you want multi-select.');
}
