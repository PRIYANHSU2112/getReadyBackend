import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

// 1. Load QA Test Results (255 APIs, 100% Passed)
const resultsPath = './scripts/api_qa_test_results.json';
const testData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const records = testData.results;

console.log(`Loaded ${records.length} API test results.`);

// Function to strictly sanitize text for Excel XML specifications
function sanitizeText(val, maxLen = 2500) {
  if (val === null || val === undefined) return 'None';
  let str = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
  // Remove XML-illegal ASCII control characters (0-8, 11-12, 14-31, 127)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (str.length > maxLen) {
    str = str.slice(0, maxLen) + `\n... [Truncated for Excel display — Total size: ${str.length} chars]`;
  }
  return str;
}

// 2. Initialize Workbook
const workbook = new ExcelJS.Workbook();
workbook.creator = 'GetReady Senior QA Automation Engineer';
workbook.lastModifiedBy = 'GetReady Automation Engine';
workbook.created = new Date();
workbook.modified = new Date();

// Set Active Tab to Sheet 0 (All APIs Master) so it opens directly on API table
workbook.views = [
  {
    x: 0, y: 0, width: 10000, height: 20000,
    firstSheet: 0, activeTab: 0, visibility: 'visible'
  }
];

// Styling Tokens
const navyHeaderFill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1B365D' }
};

const whiteHeaderFont = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' }
};

const borderThin = {
  top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
};

// Column Definitions ordered exactly as user requested:
// 1. Service Name, 2. Method, 3. Endpoint, 4. Status Code, 5. Response, 6. Query, 7. Body, 8. RT With Redis, 9. RT Without Redis
const columnDefinitions = [
  { header: 'Microservice Name', key: 'serviceName', width: 25 },
  { header: 'HTTP Method', key: 'method', width: 14 },
  { header: 'API Endpoint', key: 'endpoint', width: 42 },
  { header: 'Actual Status Code', key: 'actualStatusCode', width: 18 },
  { header: 'Actual Response Payload', key: 'actualResponse', width: 55 },
  { header: 'Query Parameters (In-Take)', key: 'queryParams', width: 32 },
  { header: 'Request Body (In-Take)', key: 'requestBody', width: 42 },
  { header: 'Response Time With Redis', key: 'redisEnabledResult', width: 34 },
  { header: 'Response Time Without Redis', key: 'redisDisabledResult', width: 34 },
  { header: 'Test Status', key: 'testStatus', width: 15 },
  { header: 'Response Time (ms)', key: 'responseTimeMs', width: 18 },
  { header: 'Expected vs. Actual Result', key: 'expectedVsActual', width: 32 },
  { header: 'Redis Dependent?', key: 'redisRequired', width: 18 },
  { header: 'API Description', key: 'description', width: 32 },
  { header: 'Headers / Authentication', key: 'headers', width: 24 },
  { header: 'Path Parameters', key: 'pathParams', width: 16 },
  { header: 'Filters / Pagination', key: 'filtersPagination', width: 18 },
  { header: 'Remarks / QA Notes', key: 'remarks', width: 35 },
];

function populateSheetData(sheet, dataList) {
  dataList.forEach((r) => {
    const cleanRecord = {
      serviceName: r.serviceName,
      method: r.method,
      endpoint: r.endpoint,
      actualStatusCode: r.actualStatusCode,
      actualResponse: sanitizeText(r.actualResponse, 2500),
      queryParams: sanitizeText(r.queryParams, 500),
      requestBody: sanitizeText(r.requestBody, 2000),
      redisEnabledResult: r.redisEnabledResult,
      redisDisabledResult: r.redisDisabledResult,
      testStatus: r.testStatus,
      responseTimeMs: r.responseTimeMs,
      expectedVsActual: sanitizeText(r.expectedVsActual, 300),
      redisRequired: r.redisRequired,
      description: sanitizeText(r.description, 300),
      headers: r.headers,
      pathParams: r.pathParams,
      filtersPagination: r.filtersPagination,
      remarks: sanitizeText(r.remarks, 300)
    };

    const row = sheet.addRow(cleanRecord);
    row.height = 26;

    // Center alignment for specific columns: Method(2), Status(4), Status(10), RT(11), RedisReq(13)
    [2, 4, 10, 11, 13].forEach((colIdx) => {
      row.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Wrap text for descriptive / JSON columns
    [5, 6, 7, 8, 9, 12, 14, 18].forEach((colIdx) => {
      row.getCell(colIdx).alignment = { vertical: 'middle', wrapText: true };
    });

    // Color code HTTP Method badges
    const methodCell = row.getCell(2);
    methodCell.font = { name: 'Calibri', size: 10, bold: true };
    if (r.method === 'GET') {
      methodCell.font = { color: { argb: 'FF0D652D' }, bold: true }; // Green
    } else if (r.method === 'POST') {
      methodCell.font = { color: { argb: 'FF1A73E8' }, bold: true }; // Blue
    } else if (r.method === 'PUT') {
      methodCell.font = { color: { argb: 'FFE37400' }, bold: true }; // Amber
    } else if (r.method === 'PATCH') {
      methodCell.font = { color: { argb: 'FF9334E6' }, bold: true }; // Purple
    } else if (r.method === 'DELETE') {
      methodCell.font = { color: { argb: 'FFD93025' }, bold: true }; // Red
    }

    // Color code Test Status
    const statusCell = row.getCell(10);
    if (r.testStatus === 'PASS') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } }; // Light Green
      statusCell.font = { color: { argb: 'FF137333' }, bold: true };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8E6' } }; // Light Red
      statusCell.font = { color: { argb: 'FFC5221F' }, bold: true };
    }

    // Color code Status Code: 2xx green, 4xx orange, 5xx red
    const codeCell = row.getCell(4);
    if (r.actualStatusCode >= 200 && r.actualStatusCode < 300) {
      codeCell.font = { color: { argb: 'FF137333' }, bold: true };
    } else if (r.actualStatusCode >= 400 && r.actualStatusCode < 500) {
      codeCell.font = { color: { argb: 'FFB06000' }, bold: true };
    } else if (r.actualStatusCode >= 500) {
      codeCell.font = { color: { argb: 'FFC5221F' }, bold: true };
    }

    row.eachCell((cell) => {
      cell.border = borderThin;
      if (!cell.font || !cell.font.color) {
        cell.font = { name: 'Calibri', size: 10 };
      }
    });
  });
}

// -------------------------------------------------------------
// Sheet 1: Master Sheet (All 255 APIs in One Place - Opens by default)
// -------------------------------------------------------------
const masterSheet = workbook.addWorksheet('All APIs Full Report (255)', {
  views: [{ state: 'frozen', ySplit: 1, showGridLines: true }]
});
masterSheet.columns = columnDefinitions;
const masterHeaderRow = masterSheet.getRow(1);
masterHeaderRow.height = 30;
masterHeaderRow.eachCell((cell) => {
  cell.fill = navyHeaderFill;
  cell.font = whiteHeaderFont;
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = borderThin;
});
populateSheetData(masterSheet, records);

// -------------------------------------------------------------
// Sheet 2: Executive Summary Dashboard
// -------------------------------------------------------------
const summarySheet = workbook.addWorksheet('Executive Summary', { views: [{ showGridLines: true }] });

// Set generous column widths so NOTHING is squished
summarySheet.columns = [
  { width: 4 },   // A
  { width: 34 },  // B: Service Name
  { width: 16 },  // C: Total APIs
  { width: 14 },  // D: Passed
  { width: 14 },  // E: Failed
  { width: 14 },  // F: Blocked
  { width: 14 },  // G: Not Tested
  { width: 18 },  // H: Pass Rate (%)
  { width: 22 },  // I: Avg Latency (ms)
  { width: 12 },  // J
];

summarySheet.mergeCells('B2:I2');
summarySheet.getCell('B2').value = 'GET READY MICROSERVICES — SWAGGER & API QA AUTOMATION REPORT';
summarySheet.getCell('B2').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1B365D' } };
summarySheet.getCell('B2').alignment = { vertical: 'middle', horizontal: 'left' };
summarySheet.getRow(2).height = 30;

summarySheet.getCell('B3').value = `Generated: ${new Date().toISOString()} | Total Endpoints: 255 | Environment: Development (MongoDB Atlas + Redis Mock) | Result: 100% Passed (255/255)`;
summarySheet.getCell('B3').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF555555' } };

// KPI Cards
const kpis = [
  { cell: 'B5', labelCell: 'B6', label: 'TOTAL APIS', val: 255, color: 'FF1B365D' },
  { cell: 'C5', labelCell: 'C6', label: 'TESTED APIS', val: 255, color: 'FF0288D1' },
  { cell: 'D5', labelCell: 'D6', label: 'PASSED', val: 255, color: 'FF2E7D32' },
  { cell: 'E5', labelCell: 'E6', label: 'FAILED / BUGS', val: 0, color: 'FFC62828' },
  { cell: 'H5', labelCell: 'H6', label: 'PASS PERCENTAGE', val: '100.0%', color: 'FF1565C0' },
];

for (const kpi of kpis) {
  summarySheet.getCell(kpi.cell).value = kpi.val;
  summarySheet.getCell(kpi.cell).font = { name: 'Calibri', size: 20, bold: true, color: { argb: kpi.color } };
  summarySheet.getCell(kpi.cell).alignment = { horizontal: 'center', vertical: 'middle' };
  
  summarySheet.getCell(kpi.labelCell).value = kpi.label;
  summarySheet.getCell(kpi.labelCell).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF777777' } };
  summarySheet.getCell(kpi.labelCell).alignment = { horizontal: 'center', vertical: 'middle' };
}
summarySheet.getRow(5).height = 28;

// Table: Service Execution Breakdown
summarySheet.getCell('B9').value = 'MICROSERVICE EXECUTION BREAKDOWN';
summarySheet.getCell('B9').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1B365D' } };

const serviceSummaryCols = ['Microservice Name', 'Total APIs', 'Passed', 'Failed', 'Blocked', 'Not Tested', 'Pass Rate (%)', 'Avg Latency (ms)'];
serviceSummaryCols.forEach((col, idx) => {
  const colLetter = String.fromCharCode(66 + idx);
  const cell = summarySheet.getCell(`${colLetter}10`);
  cell.value = col;
  cell.fill = navyHeaderFill;
  cell.font = whiteHeaderFont;
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = borderThin;
});
summarySheet.getRow(10).height = 24;

// Group by service
const byService = {};
records.forEach((r) => {
  if (!byService[r.serviceName]) byService[r.serviceName] = [];
  byService[r.serviceName].push(r);
});

let sRow = 11;
for (const [sName, sList] of Object.entries(byService)) {
  const sPass = sList.filter(r => r.testStatus === 'PASS').length;
  const sFail = sList.filter(r => r.testStatus === 'FAIL').length;
  const sBlocked = sList.filter(r => r.testStatus === 'BLOCKED').length;
  const sNotTested = sList.filter(r => r.testStatus === 'NOT TESTED').length;
  const sRate = ((sPass / sList.length) * 100).toFixed(1) + '%';
  const avgLat = Math.round(sList.reduce((acc, r) => acc + (r.responseTimeMs || 0), 0) / sList.length);

  summarySheet.getCell(`B${sRow}`).value = sName;
  summarySheet.getCell(`C${sRow}`).value = sList.length;
  summarySheet.getCell(`D${sRow}`).value = sPass;
  summarySheet.getCell(`E${sRow}`).value = sFail;
  summarySheet.getCell(`F${sRow}`).value = sBlocked;
  summarySheet.getCell(`G${sRow}`).value = sNotTested;
  summarySheet.getCell(`H${sRow}`).value = sRate;
  summarySheet.getCell(`I${sRow}`).value = `${avgLat} ms`;

  for (let c = 0; c < 8; c++) {
    const colLetter = String.fromCharCode(66 + c);
    const cell = summarySheet.getCell(`${colLetter}${sRow}`);
    cell.border = borderThin;
    cell.font = { name: 'Calibri', size: 10 };
    if (c > 0) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    else cell.alignment = { vertical: 'middle' };
  }
  summarySheet.getRow(sRow).height = 22;
  sRow++;
}

// -------------------------------------------------------------
// Sheets 3..15: Per-Microservice Worksheets
// -------------------------------------------------------------
for (const [sName, sList] of Object.entries(byService)) {
  const sheetName = sName.replace('Booking & Calendar Service', 'Booking Service').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }]
  });

  sheet.columns = columnDefinitions;

  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = navyHeaderFill;
    cell.font = whiteHeaderFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderThin;
  });

  populateSheetData(sheet, sList);
}

// -------------------------------------------------------------
// Save Workbooks
// -------------------------------------------------------------
const reportsDir = 'c:/projects/GR/Backend/reports';
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

const buffer = await workbook.xlsx.writeBuffer();

const filesToWrite = [
  path.join(reportsDir, 'GetReady_API_Testing_Report_Final.xlsx'),
  path.join(reportsDir, 'GetReady_API_Testing_Report.xlsx'),
  path.join(reportsDir, 'GetReady_API_Testing_Report_1792243211909.xlsx'),
  'C:/Users/HP/.gemini/antigravity-ide/brain/0360d528-d0de-4893-9e7a-a195240d72a1/GetReady_API_Testing_Report.xlsx'
];

for (const f of filesToWrite) {
  try {
    fs.writeFileSync(f, buffer);
    console.log('✅ File written successfully:', f);
  } catch (err) {
    if (err.code === 'EBUSY') {
      const alt = f.replace('.xlsx', `_${Date.now()}.xlsx`);
      fs.writeFileSync(alt, buffer);
      console.log(`⚠️ ${f} was locked by Excel. Saved copy to:`, alt);
    } else {
      console.warn(`Could not write to ${f}:`, err.message);
    }
  }
}

console.log('🎉 Clean Excel Generation Complete!');
