const COBRA = Object.freeze({
  dashboardUrl: 'https://bezza90-jpg.github.io/cobra-liverc-stats/data/dashboard.json',
  sheetName: 'Setup Submissions',
  folderName: 'COBRA Driver Setup Submissions',
  maxFileBytes: 8 * 1024 * 1024,
  allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'],
  brands: ['Team Associated', 'Schumacher', 'XRAY', 'TLR', 'PR Racing', 'Yokomo', 'R1 Wurks', 'Kyosho', 'Serpent', 'Mugen Seiki', 'Tamiya', 'LC Racing', 'Tekno RC', 'Sworkz', 'Other'],
  classes: ['2WD', '4WD', 'Vintage', 'Truck'],
  headers: ['Submission ID', 'Submitted At', 'Status', 'Driver Name', 'Driver Key', 'Manufacturer', 'Car Model', 'Class', 'Event ID', 'Event Name', 'Event Date', 'Notes', 'Original Filename', 'Stored Filename', 'MIME Type', 'File Size', 'Drive File ID', 'Public View URL', 'Public Preview URL', 'Reviewed At']
});

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '').toLowerCase();
  if (action === 'list') return approvedSetupResponse_(e);

  return HtmlService.createHtmlOutputFromFile('Upload')
    .setTitle('Upload a COBRA driver setup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setupProject() {
  const properties = PropertiesService.getScriptProperties();
  let folder;
  let spreadsheet;

  const existingFolderId = properties.getProperty('UPLOAD_FOLDER_ID');
  const existingSheetId = properties.getProperty('SPREADSHEET_ID');
  if (existingFolderId) folder = DriveApp.getFolderById(existingFolderId);
  if (existingSheetId) spreadsheet = SpreadsheetApp.openById(existingSheetId);

  if (!folder) {
    folder = DriveApp.createFolder(COBRA.folderName);
    properties.setProperty('UPLOAD_FOLDER_ID', folder.getId());
  }

  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create('COBRA Driver Setup Approvals');
    properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  }

  const sheet = spreadsheet.getSheets()[0];
  sheet.setName(COBRA.sheetName);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, COBRA.headers.length).setValues([COBRA.headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, COBRA.headers.length).setBackground('#067b14').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange('C2:C').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Pending', 'Approved', 'Rejected'], true).setAllowInvalid(false).build());
  sheet.autoResizeColumns(1, COBRA.headers.length);
  sheet.setColumnWidth(4, 170);
  sheet.setColumnWidth(10, 260);
  sheet.setColumnWidth(12, 320);

  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'onSubmissionStatusEdit')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('onSubmissionStatusEdit').forSpreadsheet(spreadsheet).onEdit().create();

  const result = {
    spreadsheetUrl: spreadsheet.getUrl(),
    folderUrl: folder.getUrl(),
    message: 'COBRA setup storage and approval sheet are ready.'
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function getFormOptions() {
  assertConfigured_();
  const dashboard = loadDashboard_();
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(`upload:${token}`, 'ready', 3600);
  return {
    token: token,
    maxFileBytes: COBRA.maxFileBytes,
    brands: COBRA.brands,
    classes: COBRA.classes,
    events: (dashboard.events || []).slice().sort((a, b) => String(b.d).localeCompare(String(a.d))).map(event => ({ id: String(event.i), name: event.n, date: event.d })),
    drivers: (dashboard.drivers || []).map(driver => driver.n).sort()
  };
}

function submitSetup(payload) {
  assertConfigured_();
  if (!payload || payload.website) throw new Error('Submission rejected.');
  const cache = CacheService.getScriptCache();
  const tokenKey = `upload:${String(payload.token || '')}`;
  if (!payload.token || cache.get(tokenKey) !== 'ready') throw new Error('This upload form has expired. Refresh the form and try again.');

  const driverName = cleanText_(payload.driverName, 80, true, 'Driver name');
  const brand = cleanText_(payload.brand, 50, true, 'Manufacturer');
  const className = cleanText_(payload.className, 20, true, 'Class');
  const model = cleanText_(payload.model, 80, false);
  const notes = cleanText_(payload.notes, 2000, false);
  if (COBRA.brands.indexOf(brand) === -1) throw new Error('Please select a manufacturer from the list.');
  if (COBRA.classes.indexOf(className) === -1) throw new Error('Please select a valid racing class.');

  const originalFilename = cleanFilename_(payload.fileName);
  const extension = originalFilename.split('.').pop().toLowerCase();
  if (COBRA.allowedExtensions.indexOf(extension) === -1) throw new Error('That file type is not supported.');
  const base64 = String(payload.fileBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64) throw new Error('Please choose a setup file.');
  const bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > COBRA.maxFileBytes) throw new Error('The file must be no larger than 8 MB.');

  const dashboard = loadDashboard_();
  const eventId = String(payload.eventId || '').trim();
  const event = eventId ? (dashboard.events || []).find(item => String(item.i) === eventId) : null;
  if (eventId && !event) throw new Error('The selected event could not be verified. Refresh the form and try again.');
  const driver = (dashboard.drivers || []).find(item => normaliseName_(item.n) === normaliseName_(driverName));

  const submissionId = Utilities.getUuid();
  const storedFilename = `${submissionId}-${slug_(driverName)}-${slug_(className)}.${extension}`;
  const mimeType = cleanMimeType_(payload.fileType, extension);
  const blob = Utilities.newBlob(bytes, mimeType, storedFilename);
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('UPLOAD_FOLDER_ID'));
  cache.remove(tokenKey);
  const file = folder.createFile(blob).setDescription(`Pending COBRA setup submission from ${driverName}`);
  const now = new Date();

  const sheet = submissionSheet_();
  sheet.appendRow([
    submissionId, now, 'Pending', safeSheetText_(driverName), driver ? driver.k : '', safeSheetText_(brand), safeSheetText_(model), className,
    event ? String(event.i) : '', event ? safeSheetText_(event.n) : '', event ? event.d : '', safeSheetText_(notes),
    safeSheetText_(originalFilename), storedFilename, mimeType, bytes.length, file.getId(), '', '', ''
  ]);
  const row = sheet.getLastRow();
  sheet.getRange(row, 1, 1, COBRA.headers.length).setVerticalAlignment('top').setWrap(true);

  return { ok: true, submissionId: submissionId, message: 'Thank you. Your setup has been submitted to COBRA for approval.' };
}

function onSubmissionStatusEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== COBRA.sheetName || e.range.getColumn() !== 3 || e.range.getRow() < 2) return;
  const sheet = e.range.getSheet();
  const status = String(e.value || '').trim();
  const rowNumber = e.range.getRow();
  const row = sheet.getRange(rowNumber, 1, 1, COBRA.headers.length).getValues()[0];
  const fileId = String(row[16] || '');
  if (!fileId) return;
  const file = DriveApp.getFileById(fileId);

  if (status === 'Approved') {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    try { file.setSecurityUpdateEnabled(false); } catch (error) { console.log(error.message); }
    file.setDescription(`Approved COBRA setup shared by ${row[3]}`);
    sheet.getRange(rowNumber, 18, 1, 3).setValues([[
      `https://drive.google.com/file/d/${fileId}/view`,
      `https://drive.google.com/file/d/${fileId}/preview`,
      new Date()
    ]]);
  } else {
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    file.setDescription(`${status || 'Pending'} COBRA setup submission from ${row[3]}`);
    sheet.getRange(rowNumber, 18, 1, 3).clearContent();
  }
}

function approvedSetupResponse_(e) {
  const callback = String((e && e.parameter && e.parameter.callback) || 'cobraSetupLibrary');
  const safeCallback = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback) ? callback : 'cobraSetupLibrary';
  let payload;
  try {
    payload = { ok: true, setups: approvedSetups_() };
  } catch (error) {
    payload = { ok: false, error: error.message };
  }
  return ContentService.createTextOutput(`${safeCallback}(${JSON.stringify(payload)});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function approvedSetups_() {
  assertConfigured_();
  const sheet = submissionSheet_();
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, COBRA.headers.length).getValues();
  return values.filter(row => String(row[2]).trim() === 'Approved' && row[17] && row[18]).map(row => ({
    id: String(row[0]),
    submittedAt: isoDate_(row[1]),
    driverName: String(row[3]),
    driverKey: String(row[4] || ''),
    brand: String(row[5]),
    model: String(row[6] || ''),
    className: String(row[7]),
    eventId: String(row[8] || ''),
    eventName: String(row[9] || ''),
    eventDate: String(row[10] || ''),
    notes: String(row[11] || ''),
    fileName: String(row[12] || ''),
    mimeType: String(row[14] || ''),
    viewUrl: String(row[17]),
    previewUrl: String(row[18]),
    reviewedAt: isoDate_(row[19])
  }));
}

function loadDashboard_() {
  const response = UrlFetchApp.fetch(COBRA.dashboardUrl, { muteHttpExceptions: true, followRedirects: true });
  if (response.getResponseCode() !== 200) throw new Error('Unable to load the COBRA event list.');
  const source = JSON.parse(response.getContentText());
  return {
    events: source.events || [],
    drivers: source.drivers || []
  };
}

function submissionSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(spreadsheetId).getSheetByName(COBRA.sheetName);
}

function assertConfigured_() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('SPREADSHEET_ID') || !properties.getProperty('UPLOAD_FOLDER_ID')) throw new Error('The setup library has not been configured yet. Run setupProject once.');
}

function cleanText_(value, maximum, required, label) {
  const result = String(value || '').replace(/\u0000/g, '').trim();
  if (required && !result) throw new Error(`${label || 'This field'} is required.`);
  if (result.length > maximum) throw new Error(`${label || 'A field'} is too long.`);
  return result;
}

function cleanFilename_(value) {
  const result = String(value || '').replace(/[^A-Za-z0-9._ -]/g, '_').trim().slice(0, 160);
  if (!result || result.indexOf('.') === -1) throw new Error('The uploaded file needs a valid filename.');
  return result;
}

function cleanMimeType_(value, extension) {
  const known = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv', txt: 'text/plain'
  };
  return known[extension] || String(value || 'application/octet-stream');
}

function normaliseName_(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function safeSheetText_(value) {
  const text = String(value || '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function slug_(value) {
  return normaliseName_(value).toLowerCase().slice(0, 50) || 'setup';
}

function isoDate_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
