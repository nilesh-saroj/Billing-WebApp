# Weighment Slip Implementation

Follow the pattern of Challan generation and printing. Add these changes to your Billing Dashboard Page.html

## STEP 1: Add CSS Styles (after challan styles)

```css
/* ============ WEIGHMENT SLIP PAGE ============ */

.weighment-slip-paper {
  display: none;
  padding: 16px 16px 18px;
}

.weighment-slip-paper.show {
  display: block;
  animation: fadeIn .3s ease;
}

.weighment-block {
  font-family: Calibri, Arial, sans-serif;
  font-size: 11px;
  color: #000;
  line-height: 1.35;
}

.weighment-block table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #000;
}

.weighment-block td {
  border: 1px solid #000;
  padding: 6px 8px;
  vertical-align: top;
}

.ws-title {
  font-size: 18px;
  font-weight: bold;
  text-align: center;
  padding: 8px;
}

.ws-header {
  font-weight: bold;
  text-align: left;
  background: #f5f5f5;
  width: 50%;
}

.ws-value {
  text-align: left;
}

.ws-label {
  font-weight: 600;
  text-align: left;
  width: 30%;
}

.ws-field-value {
  text-align: center;
  font-weight: bold;
}

.weighment-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex: 1;
  min-height: 400px;
  color: #8a8078;
  width: 100%;
}

.weighment-empty svg {
  width: 52px;
  height: 52px;
  color: #a8a09a;
}

.weighment-empty p {
  font-size: 14px;
  margin: 0;
}

.print-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

@media print {
  #weighmentPrintArea .weighment-sep {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6mm 0;
    width: 100%;
  }

  #weighmentPrintArea .weighment-sep::before,
  #weighmentPrintArea .weighment-sep::after {
    content: "";
    flex: 1;
    border-top: 1.5px dashed #888;
  }

  #weighmentPrintArea .weighment-sep span {
    font-size: 8pt;
    color: #888;
    white-space: nowrap;
    font-family: Arial, sans-serif;
  }
}
```

## STEP 2: Add Navigation Item to Sidebar (in nav section)

```html
<!-- Add this after the challan nav item -->
<div class="nav-item" onclick="openView('view-weighment')">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2l7 4v6c0 5-7 8-7 8s-7-3-7-8V6l7-4z"></path>
  </svg>
  Weighment Slip
</div>
```

## STEP 3: Add HTML Section (after challan section)

```html
<!-- ─── WEIGHMENT SLIP ──────────────────────────────── -->
<section class="view" id="view-weighment">

  <div class="topbar">
    <div>
      <p class="eyebrow">Page // 05</p>
      <h1 class="page-title">Weighment Slip</h1>
      <p class="page-sub">Select a dispatched IN number to generate and print the weighment slip.</p>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <h2>Generate Weighment Slip</h2>
    </div>

    <div class="panel-body">
      <div class="field">
        <label>Select Dispatched IN Number</label>
        <select id="weighmentSelect" onchange="loadWeighmentData()">
          <option value="">Loading dispatched IN numbers…</option>
        </select>
        <p class="field-hint" id="weighmentSelectHint">Select an IN with dispatch data to generate slip.</p>
      </div>

      <!-- Weighment data summary card -->
      <div id="weighmentSummary" style="display:none; animation: fadeIn 0.3s ease;">
        <div style="background:var(--steel-light); border:1px solid var(--line); border-radius:var(--radius-sm); padding:14px 16px; margin-bottom:18px;">
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px 20px;">
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">IN Number</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;" id="ws_inNo">—</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Ticket No.</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;" id="ws_ticketNo">—</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Net Weight</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:13.5px;" id="ws_netWeight">—</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Port/State</div>
              <div style="font-size:13px;" id="ws_port">—</div>
            </div>
          </div>
        </div>

        <div class="weighment-slip-paper" id="weighmentPreview">
          <!-- injected by renderWeighmentPreview() -->
        </div>

        <div class="print-actions">
          <button class="btn btn-amber full" onclick="printWeighment()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Print Weighment Slip
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div class="weighment-empty" id="weighmentEmpty" style="display:flex;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 12h6m-6 4h6M9 8h6m-9-4v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2z"></path>
        </svg>
        <p>Select a dispatched IN number to preview the weighment slip</p>
      </div>

    </div>
  </div>

</section>
```

## STEP 4: Add Print Area (after challan print area)

```html
<!-- ══ WEIGHMENT PRINT AREA (only visible when printing) ═══════ -->
<div id="weighmentPrintArea" style="display:none;">
  <!-- populated by JS before window.print() -->
</div>
```

## STEP 5: Add JavaScript Functions (in the script section)

### Global Variables (add with challan variables)

```javascript
let weighmentDispatchList = [];
let currentWeighmentData = null;
```

### Main Functions

```javascript
/* ═══════════════════════════════════════════════════════════
   WEIGHMENT SLIP
═══════════════════════════════════════════════════════════ */

function loadDispatchedList(isManualRefresh) {
  const select = document.getElementById("weighmentSelect");
  const hint = document.getElementById("weighmentSelectHint");

  if (!isManualRefresh) {
    select.innerHTML = "<option value=''>Loading…</option>";
  }

  hint.innerText = "Loading dispatched IN numbers…";

  google.script.run
    .withSuccessHandler(function(list) {
      weighmentDispatchList = list || [];
      
      if (weighmentDispatchList.length === 0) {
        select.innerHTML = "<option value=''>No dispatched IN numbers found</option>";
        hint.innerText = "No IN numbers with dispatch data available.";
        return;
      }

      select.innerHTML = '<option value="">Select an IN number…</option>';
      
      weighmentDispatchList.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.inNo;
        opt.textContent = `${item.inNo} • ${item.commodity || 'N/A'} • ${item.vehicleNo || 'N/A'}`;
        select.appendChild(opt);
      });

      hint.innerText = `${weighmentDispatchList.length} dispatched IN numbers available.`;
    })
    .withFailureHandler(function(err) {
      console.error(err);
      select.innerHTML = "<option value=''>Error loading data</option>";
      hint.innerText = "Failed to load IN numbers. Try refreshing.";
    })
    .getDispatchedINList();
}

function loadWeighmentData() {
  const inNo = document.getElementById("weighmentSelect").value;

  if (!inNo) {
    document.getElementById("weighmentSummary").style.display = "none";
    document.getElementById("weighmentEmpty").style.display = "flex";
    return;
  }

  google.script.run
    .withSuccessHandler(function(data) {
      if (data.error) {
        showToast(data.error, "danger");
        return;
      }

      currentWeighmentData = data;
      renderWeighmentPreview(data);
      updateWeighmentSummary(data);
      
      document.getElementById("weighmentEmpty").style.display = "none";
      document.getElementById("weighmentSummary").style.display = "block";
    })
    .withFailureHandler(function(err) {
      console.error(err);
      showToast("Failed to load weighment data", "danger");
    })
    .getWeighmentData(inNo);
}

function updateWeighmentSummary(d) {
  document.getElementById("ws_inNo").textContent = d.inNo || "—";
  document.getElementById("ws_ticketNo").textContent = d.ticketNo || "—";
  document.getElementById("ws_netWeight").textContent = d.netWeightKg ? `${d.netWeightKg} Kg` : "—";
  document.getElementById("ws_port").textContent = d.portState ? `${d.port || '—'} • ${d.portState}` : "—";
}

function buildWeighmentBlock(d, copyLabel) {
  const e = function(str) { return String(str || "").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  
  const fmtWeight = function(w) {
    if (!w) return "—";
    const kg = parseFloat(w);
    return isNaN(kg) ? "—" : kg.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  };

  const w = fmtWeight;
  const inNo = e(d.inNo || "");
  const port = e(d.port || "—");
  const state = e(d.portState || "—");
  const pin = e(d.portPin || "—");
  const ticketNo = e(d.ticketNo || "—");
  const commodity = e(d.commodity || "—");
  const vehicleNo = e(d.vehicleNo || "—");
  const grossWt = w(d.grossWeight);
  const tareWt = w(d.tareWeight);
  const netWt = w(d.netWeightKg);
  const netWtWords = e(d.netWeightWords || "—");
  const grossDate = e(d.inDate || "—");
  const grossTime = e(d.inTime || "—");
  const tareDate = e(d.outDate || "—");
  const tareTime = e(d.outTime || "—");

  return `
    <div class="weighment-block">
      <table>
        <tr>
          <td colspan="4" class="ws-title">WEIGHMENT SLIP</td>
        </tr>
        <tr>
          <td class="ws-header" colspan="2">Port: <strong>${port}</strong></td>
          <td class="ws-header" colspan="2">State: <strong>${state}</strong> | PIN: <strong>${pin}</strong></td>
        </tr>
        <tr>
          <td class="ws-label"><strong>Ticket No.</strong></td>
          <td class="ws-field-value" style="width:25%">${ticketNo}</td>
          <td class="ws-label"><strong>Commodity</strong></td>
          <td class="ws-field-value" style="width:25%">${commodity}</td>
        </tr>
        <tr>
          <td class="ws-label"><strong>Vehicle No.</strong></td>
          <td colspan="3" class="ws-field-value">${vehicleNo}</td>
        </tr>
        <tr>
          <td class="ws-label"><strong>Gross Weight</strong></td>
          <td class="ws-field-value">${grossWt}</td>
          <td class="ws-label"><strong>Date</strong></td>
          <td class="ws-field-value">${grossDate}</td>
        </tr>
        <tr>
          <td class="ws-label"></td>
          <td class="ws-field-value"></td>
          <td class="ws-label"><strong>Time</strong></td>
          <td class="ws-field-value">${grossTime}</td>
        </tr>
        <tr>
          <td class="ws-label"><strong>Tare Weight</strong></td>
          <td class="ws-field-value">${tareWt}</td>
          <td class="ws-label"><strong>Date</strong></td>
          <td class="ws-field-value">${tareDate}</td>
        </tr>
        <tr>
          <td class="ws-label"></td>
          <td class="ws-field-value"></td>
          <td class="ws-label"><strong>Time</strong></td>
          <td class="ws-field-value">${tareTime}</td>
        </tr>
        <tr>
          <td class="ws-label"><strong>Net Weight</strong></td>
          <td colspan="3" class="ws-field-value">${netWt}</td>
        </tr>
        <tr>
          <td class="ws-label"><strong>Net Weight (Words)</strong></td>
          <td colspan="3" class="ws-value">${netWtWords}</td>
        </tr>
        <tr style="height:60px;">
          <td colspan="4" style="text-align:right; padding-right:20px; vertical-align:bottom;">
            <strong>Signature</strong>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function renderWeighmentPreview(d) {
  const preview = document.getElementById("weighmentPreview");
  preview.innerHTML =
    buildWeighmentBlock(d, "Original") +
    '<div style="text-align:center; margin:12px 0; font-size:10px; font-family:Arial;">✂ PRINT HERE ✂</div>' +
    buildWeighmentBlock(d, "Duplicate");
}

function printWeighment() {
  if (!currentWeighmentData) {
    showToast("No weighment slip loaded. Select an IN number first.", "danger");
    return;
  }

  const d = currentWeighmentData;
  const printArea = document.getElementById("weighmentPrintArea");

  printArea.innerHTML =
    buildWeighmentBlock(d, "Original") +
    '<div class="weighment-sep"><span>✂ &nbsp; DUPLICATE COPY &nbsp; ✂</span></div>' +
    buildWeighmentBlock(d, "Duplicate");

  setTimeout(function() {
    const printWindow = window.open("", "", "width=800,height=600");
    printWindow.document.write(printArea.innerHTML);
    printWindow.document.write(`
      <style>
        body { font-family: Calibri, Arial, sans-serif; margin: 0; padding: 10mm; }
        .weighment-block table { width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 11px; }
        .weighment-block td { border: 1px solid #000; padding: 6px 8px; }
        .ws-title { font-size: 18px; font-weight: bold; text-align: center; padding: 8px; }
        .ws-header { font-weight: bold; text-align: left; background: #f5f5f5; }
        .ws-label { font-weight: 600; text-align: left; }
        .ws-field-value { text-align: center; font-weight: bold; }
        .ws-value { text-align: left; }
        .weighment-sep { text-align: center; margin: 15mm 0; font-size: 10px; }
        @media print {
          body { margin: 0; padding: 0; }
          .weighment-sep { page-break-before: always; }
        }
      </style>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  }, 100);
}

function openView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  
  if (viewId === "view-weighment") {
    if (weighmentDispatchList.length === 0) {
      loadDispatchedList();
    }
  }
}
```

## STEP 6: Add Backend Functions to Google Apps Script (.gs file)

```javascript
/***********************************************************
 *  DISPATCHED IN NUMBERS (for weighment slip dropdown)
 *  Returns list of {inNo, commodity, vehicleNo} for
 *  every IN that has dispatch data.
 ***********************************************************/
function getDispatchedINList() {
  try {
    const dispatchResponse = Sheets.Spreadsheets.Values.get(
      CONFIG.DISPATCH_SS_ID,
      `${CONFIG.DISPATCH_SHEET}!A40000:AF`
    );

    const dispatchData = dispatchResponse.values || [];
    const result = [];

    for (const row of dispatchData) {
      const inNo = String(row[CONFIG.COL_IN_NO - 1] || "").trim();
      
      if (!inNo) continue;

      const commodity = String(row[CONFIG.COL_COMMODITY - 1] || "").trim();
      const vehicleNo = String(row[CONFIG.COL_TRUCK - 1] || "").trim();

      result.push({
        inNo: inNo,
        commodity: commodity,
        vehicleNo: vehicleNo
      });
    }

    return result.reverse();
  }
  catch (err) {
    Logger.log(err);
    return [];
  }
}

/***********************************************************
 *  WEIGHMENT DATA
 *  Returns all fields needed to render Weighment Slip
 ***********************************************************/
function getWeighmentData(inNo) {
  try {
    // 1. Get Dispatch Data
    const dispatchResponse = Sheets.Spreadsheets.Values.get(
      CONFIG.DISPATCH_SS_ID,
      `${CONFIG.DISPATCH_SHEET}!A40000:AF`
    );

    const dispatchData = dispatchResponse.values || [];
    let dispatchRow = null;

    for (const row of dispatchData) {
      if (String(row[CONFIG.COL_IN_NO - 1] || "").trim() === String(inNo).trim()) {
        dispatchRow = row;
        break;
      }
    }

    if (!dispatchRow) {
      return { error: "Dispatch record not found for IN: " + inNo };
    }

    // Extract ticket number (numeric part of inNo)
    const ticketNo = String(inNo).replace(/\D/g, "");

    // Get weights (multiply by 1000 to convert to grams/units)
    const grossWeight = parseFloat(dispatchRow[CONFIG.COL_GROSSWEIGHT - 1] || 0);
    const tareWeight = parseFloat(dispatchRow[CONFIG.COL_TAREWEIGHT - 1] || 0);
    const netWeightKg = grossWeight - tareWeight;

    // Get dates and times
    const inDate = dispatchRow[CONFIG.COL_INDATE - 1]
      ? Utilities.formatDate(new Date(dispatchRow[CONFIG.COL_INDATE - 1]), Session.getScriptTimeZone(), "dd-MM-yyyy")
      : "";
    const inTime = dispatchRow[CONFIG.COL_INTIME - 1]
      ? Utilities.formatDate(new Date(dispatchRow[CONFIG.COL_INTIME - 1]), Session.getScriptTimeZone(), "HH:mm:ss")
      : "";
    const outDate = dispatchRow[CONFIG.COL_OUTDATE - 1]
      ? Utilities.formatDate(new Date(dispatchRow[CONFIG.COL_OUTDATE - 1]), Session.getScriptTimeZone(), "dd-MM-yyyy")
      : "";
    const outTime = dispatchRow[CONFIG.COL_OUTTIME - 1]
      ? Utilities.formatDate(new Date(dispatchRow[CONFIG.COL_OUTTIME - 1]), Session.getScriptTimeZone(), "HH:mm:ss")
      : "";

    // Get Port info from Biller Sheet
    let port = "";
    let portState = "";
    let portPin = "";

    try {
      const billerResponse = Sheets.Spreadsheets.Values.get(
        CONFIG.TRIAL_BILL_SS_ID,
        `${CONFIG.BILLER_SHEET}!B:F`
      );

      const billerData = billerResponse.values || [];
      const destination = String(dispatchRow[CONFIG.COL_DESTINATION - 1] || "").trim();

      for (const billerRow of billerData) {
        if (String(billerRow[0] || "").trim() === destination) {
          port = String(billerRow[1] || "").trim();
          portState = String(billerRow[2] || "").trim();
          portPin = String(billerRow[4] || "").trim();
          break;
        }
      }
    } catch (e) {
      Logger.log("Error fetching biller data: " + e);
    }

    // Convert net weight to words
    const netWeightWords = convertNumberToWords(Math.floor(netWeightKg));

    return {
      inNo: inNo,
      ticketNo: ticketNo,
      port: port,
      portState: portState,
      portPin: portPin,
      commodity: String(dispatchRow[CONFIG.COL_COMMODITY - 1] || "").trim(),
      vehicleNo: String(dispatchRow[CONFIG.COL_TRUCK - 1] || "").trim(),
      grossWeight: grossWeight,
      tareWeight: tareWeight,
      netWeightKg: netWeightKg,
      netWeightWords: netWeightWords,
      inDate: inDate,
      inTime: inTime,
      outDate: outDate,
      outTime: outTime
    };
  }
  catch (err) {
    Logger.log(err);
    return { error: "Failed to retrieve weighment data" };
  }
}
```

## STEP 7: Update CONFIG in .gs file

Make sure your CONFIG object in the .gs file has these columns defined:
```javascript
COL_IN_NO: 1,
COL_COMMODITY: 3,
COL_TRUCK: 6,
COL_GROSSWEIGHT: 8,
COL_TAREWEIGHT: 9,
COL_INDATE: 10,
COL_INTIME: 11,
COL_OUTDATE: 12,
COL_OUTTIME: 13,
COL_DESTINATION: 5,
```

Adjust column numbers based on your actual dispatch sheet structure.

