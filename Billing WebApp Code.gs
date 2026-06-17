/***********************************************************
 *  BILL MANAGEMENT WEB APP — BACKEND (Code.gs)
 *  Rawalwasia — Dispatch Billing Portal
 ***********************************************************/

const CONFIG = {

  DISPATCH_SS_ID: "1ID0zC4QlPkuXy2AWne8HWWGhhb6p3KvNmOAZ9QvlT-I",
  TRIAL_BILL_SS_ID: "1Rds83DNUqc6b4XIIgRaKmNcaavhikILVFqLU9zFm0fU",
  VESSEL_SS_ID: "18K2e26aqKxxrJwoK7kY-E5S9G5jXdW_008PjlXF3P3k",
  SALES_ORDER_SS_ID: "1c43xNhc317sruTtmpDhUJd8XpJuyiCR9DFOpMXZBffY",
  CLAIMS_SS_ID: "19oIepsXlPjmm_clyM5aufFVyEazQCOrL2Zi7W9ulGsQ",

  DISPATCH_SHEET: "Dispatch Data",
  BILL_SUBMIT_SHEET: "Bill Submit",
  SALES_ORDER_SHEET: "Sales Order",
  DO_FORM_SHEET: "DO Form",
  USER_SHEET: "Users",
  CLAIMS_SHEET: "Claims",          // NEW — auto-created if missing

  ALLOWED_DOMAIN: "@rawalwasia.in",
  CLAIM_TTL_MS: 5 * 60 * 1000,    // claims expire after 5 minutes

  // Dispatch columns (1-based)
  COL_IN_NO: 2,
  COL_INTIME: 3,
  COL_OUTTIME: 16,
  COL_PARTY: 8,
  COL_DONO: 9,
  COL_FROM: 5,
  COL_TERM: 34,
  COL_DESTINATION: 15,
  COL_VESSELNAME: 11,
  COL_TRADER: 12,
  COL_TRUCK: 14,
  COL_TRANSPORTER: 13,
  COL_TRANSPORTPURCHASERATE: 23,
  COL_PDO: 10,
  COL_PDO_TYPE: 33,
  COL_GROSSWEIGHT: 19,
  COL_TAREWEIGHT: 20,
  COL_SOTYPE: 18,
  COL_SONO: 4,
  COL_SEALNO: 28,
  COL_NET_WEIGHT: 21,
  COL_REMARKS: 32

};

/***********************************************************
 *  WEB APP ENTRY POINT
 ***********************************************************/
function doGet() {

  const email = Session.getActiveUser().getEmail();

  if (
    !email ||
    !email.endsWith(CONFIG.ALLOWED_DOMAIN)
  ) {

    return HtmlService
      .createHtmlOutput(
        "<div style='font-family:sans-serif;padding:40px;text-align:center;'>" +
        "<h2>Access Restricted</h2>" +
        "<p>This portal is only available to authorized company accounts.</p>" +
        "</div>"
      );

  }

  return HtmlService
    .createTemplateFromFile("Billing Dashboard Page")
    .evaluate()
    .setTitle("Bill Management — Rawalwasia")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/***********************************************************
 *  CURRENT USER
 ***********************************************************/
function getCurrentUser() {

  const email = Session.getActiveUser().getEmail();

  try {

    const billSubmitSS = SpreadsheetApp.openById(CONFIG.TRIAL_BILL_SS_ID);
    const userSheet = billSubmitSS.getSheetByName(CONFIG.USER_SHEET);

    if (userSheet) {

      const data = userSheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {

        if (String(data[i][0]).trim().toLowerCase() === email.toLowerCase()) {

          return {
            email: email,
            name: String(data[i][1]).trim() || email.split("@")[0]
          };

        }

      }

    }

  }
  catch (e) {
    Logger.log(e);
  }

  return {
    email: email,
    name: email.split("@")[0]
  };

}

/***********************************************************
 *  CLAIMS — helpers
 ***********************************************************/

/** Get or create the Claims sheet */
function getClaimsSheet_() {

  const ss = SpreadsheetApp.openById(CONFIG.CLAIMS_SS_ID);
  let sheet = ss.getSheetByName(CONFIG.CLAIMS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.CLAIMS_SHEET);
    sheet.appendRow(["Timestamp", "IN No", "User Name", "Email"]);
    sheet.setFrozenRows(1);
  }

  return sheet;

}

/**
 * Remove all rows where:
 *  - the claim has expired (> CLAIM_TTL_MS old), OR
 *  - the IN number matches AND the email matches (user releasing their own claim)
 */
function purgeClaims_(sheet, releaseInNo, releaseEmail) {

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const now = Date.now();

  // Collect rows to delete (bottom-up so indices stay valid)
  const toDelete = [];

  for (let i = data.length - 1; i >= 0; i--) {

    const ts = data[i][0] ? new Date(data[i][0]).getTime() : 0;
    const rowInNo = String(data[i][1]).trim();
    const rowEmail = String(data[i][3]).trim();

    const expired = (now - ts) > CONFIG.CLAIM_TTL_MS;
    const ownClaim = releaseInNo && releaseEmail &&
      rowInNo === releaseInNo &&
      rowEmail === releaseEmail;

    if (expired || ownClaim) {
      toDelete.push(i + 2); // +2 because data is 0-indexed and sheet has header
    }

  }

  toDelete.forEach(r => sheet.deleteRow(r));

}

/***********************************************************
 *  claimIN — called when a user selects an IN number
 *  Returns: { claimed: false }           — successfully claimed, user may proceed
 *           { claimed: true, by, since } — already claimed by someone else
 ***********************************************************/
function claimIN(inNo) {

  const user = getCurrentUser();
  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(10000);

    const sheet = getClaimsSheet_();

    // Purge expired claims first
    purgeClaims_(sheet, null, null);

    // Re-read after purge
    const lastRow = sheet.getLastRow();
    const now = Date.now();

    if (lastRow > 1) {

      const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

      for (let i = 0; i < data.length; i++) {

        const rowInNo = String(data[i][1]).trim();
        const rowEmail = String(data[i][3]).trim();
        const rowName = String(data[i][2]).trim();
        const rowTs = data[i][0] ? new Date(data[i][0]).getTime() : 0;

        if (rowInNo !== inNo) continue;

        // Someone else has a live claim on this IN
        if (rowEmail !== user.email) {
          const ageSec = Math.floor((now - rowTs) / 1000);
          const agoStr = ageSec < 60
            ? ageSec + "s ago"
            : Math.floor(ageSec / 60) + "m ago";

          return { claimed: true, by: rowName, since: agoStr };
        }

        // It's the same user — refresh their claim timestamp
        sheet.getRange(i + 2, 1).setValue(new Date());
        return { claimed: false };

      }

    }

    // No existing claim — write a new one
    sheet.appendRow([new Date(), inNo, user.name, user.email]);
    return { claimed: false };

  } catch (e) {
    Logger.log(e);
    return { claimed: false }; // fail open — don't block the user on a lock error
  } finally {
    try { lock.releaseLock(); } catch (e) { }
  }

}

/***********************************************************
 *  releaseClaim — called when user deselects, submits,
 *  or the page unloads (navigator.sendBeacon)
 ***********************************************************/
function releaseClaim(inNo) {

  const user = getCurrentUser();

  try {

    const sheet = getClaimsSheet_();
    purgeClaims_(sheet, inNo, user.email);

  } catch (e) {
    Logger.log(e);
  }

}

/***********************************************************
 *  checkBiltyExists — lightweight as-you-type check
 *  Returns { exists: bool, inNo: string|null }
 ***********************************************************/
function checkBiltyExists(billNo) {

  if (!billNo || !billNo.trim()) return { exists: false, inNo: null };

  try {

    const ss = SpreadsheetApp.openById(CONFIG.TRIAL_BILL_SS_ID);
    const submitSheet = ss.getSheetByName(CONFIG.BILL_SUBMIT_SHEET);
    const lastRow = submitSheet.getLastRow();

    if (lastRow <= 1) return { exists: false, inNo: null };

    const data = submitSheet.getRange(2, 2, lastRow - 1, 2).getValues();
    const needle = String(billNo).trim().toLowerCase();

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][1]).trim().toLowerCase() === needle) {
        return { exists: true, inNo: String(data[i][0]).trim() };
      }
    }

    return { exists: false, inNo: null };

  } catch (e) {
    Logger.log(e);
    return { exists: false, inNo: null };
  }

}

/***********************************************************
 *  PENDING BILLS
 ***********************************************************/
function getPendingBills() {

  const ss = SpreadsheetApp.openById(CONFIG.DISPATCH_SS_ID);
  const billSubmitSS = SpreadsheetApp.openById(CONFIG.TRIAL_BILL_SS_ID);

  const dispatchSheet = ss.getSheetByName(CONFIG.DISPATCH_SHEET);
  const submitSheet = billSubmitSS.getSheetByName(CONFIG.BILL_SUBMIT_SHEET);

  const startRow = Math.max(2, 42000);  // Start the dispatch data from 40000

  const dispatchData = dispatchSheet
    .getRange(
      startRow,
      1,
      dispatchSheet.getLastRow() - startRow + 1,
      dispatchSheet.getLastColumn()
    )
    .getValues();

  let billedSet = new Set();

  const submitStartRow = Math.max(2, 100000);  // Bill Submit Data 

  if (submitSheet.getLastRow() > 1) {

    billedSet = new Set(
      submitSheet
        .getRange(submitStartRow, 2, submitSheet.getLastRow() - submitStartRow + 1, 1)
        .getValues()
        .flat()
        .map(x => String(x).trim())
    );

  }

  // Also load live claims so we can flag "being worked on"
  let claimsMap = {}; // inNo -> userName
  try {
    const claimSheet = getClaimsSheet_();
    const claimLast = claimSheet.getLastRow();
    const now = Date.now();
    if (claimLast > 1) {
      const cData = claimSheet.getRange(2, 1, claimLast - 1, 4).getValues();
      cData.forEach(r => {
        const ts = r[0] ? new Date(r[0]).getTime() : 0;
        const rowInNo = String(r[1]).trim();
        const rowName = String(r[2]).trim();
        if ((now - ts) <= CONFIG.CLAIM_TTL_MS && rowInNo) {
          claimsMap[rowInNo] = rowName;
        }
      });
    }
  } catch (e) { }

  let pending = [];

  for (let i = 1; i < dispatchData.length; i++) {

    const row = dispatchData[i];

    const inNo = String(row[CONFIG.COL_IN_NO - 1]).trim();
    const outTime = row[CONFIG.COL_OUTTIME - 1];
    const remarks = row[CONFIG.COL_REMARKS - 1];

    if (inNo && outTime && remarks !== "Cancel Entry" && !billedSet.has(inNo)) {

      pending.push({
        inNo: inNo,
        party: row[CONFIG.COL_PARTY - 1],
        truck: row[CONFIG.COL_TRUCK - 1],
        outTime: outTime
          ? Utilities.formatDate(
            new Date(outTime),
            Session.getScriptTimeZone(),
            "dd-MMM-yyyy HH:mm"
          )
          : "",
        claimedBy: claimsMap[inNo] || null   // NEW
      });

    }

  }

  // Most recent first
  pending.sort((a, b) => (a.inNo < b.inNo ? 1 : -1));

  return pending;

}

function refreshPendingBills() {
  return getPendingBills();
}

/***********************************************************
 *  BILL DETAILS FOR A SINGLE IN NUMBER
 ***********************************************************/
function getBillDetails(inNo) {

  try {

    const ss = SpreadsheetApp.openById(CONFIG.DISPATCH_SS_ID);
    const salesOrderSS = SpreadsheetApp.openById(CONFIG.SALES_ORDER_SS_ID);
    const vesselSS = SpreadsheetApp.openById(CONFIG.VESSEL_SS_ID);

    const dispatchSheet = ss.getSheetByName(CONFIG.DISPATCH_SHEET);
    const salesOrderSheet = salesOrderSS.getSheetByName(CONFIG.SALES_ORDER_SHEET);
    const doFormSheet = salesOrderSS.getSheetByName(CONFIG.DO_FORM_SHEET);
    const sheet23 = vesselSS.getSheetByName("Sheet23");

    const startRow = 42000;

    const dispatchData = dispatchSheet
      .getRange(
        startRow,
        1,
        dispatchSheet.getLastRow() - startRow + 1,
        dispatchSheet.getLastColumn()
      )
      .getValues();

    let selectedRow = null;

    for (let i = 0; i < dispatchData.length; i++) {

      const row = dispatchData[i];

      if (String(row[CONFIG.COL_IN_NO - 1]).trim() === inNo) {
        selectedRow = row;
        break;
      }

    }

    if (!selectedRow) return null;

    const soNo = String(selectedRow[CONFIG.COL_SONO - 1]).trim();
    const pdo = String(selectedRow[CONFIG.COL_PDO - 1]).trim();
    const doNo = String(selectedRow[CONFIG.COL_DONO - 1]).trim();

    //---------------------------------
    // Sheet23 lookup
    //---------------------------------

    let tallyVesselName = "";
    let handlingRate = "";

    const sheet23Data = sheet23.getDataRange().getValues();

    for (let i = 1; i < sheet23Data.length; i++) {

      const row = sheet23Data[i];

      if (String(row[0]).trim() !== pdo) continue;

      if (soNo.startsWith("RMPL")) {
        tallyVesselName = String(row[12]).trim();
      } else if (soNo.startsWith("GLBL")) {
        tallyVesselName = String(row[13]).trim();
      } else if (soNo.startsWith("OTHR")) {
        tallyVesselName = String(row[14]).trim();
      } else {
        tallyVesselName = String(row[4]).trim();
      }

      break;

    }

    for (let i = 1; i < sheet23Data.length; i++) {

      const row = sheet23Data[i];

      if (String(row[4]).trim() === tallyVesselName) {
        handlingRate = row[6];
        break;
      }

    }

    //---------------------------------
    // Sales Order lookup
    //---------------------------------

    let soType = "";
    let salesOrderDestination = "";
    let salesOrderPartyName = "";

    const salesOrderData = salesOrderSheet
      .getRange(2, 2, salesOrderSheet.getLastRow() - 1, 36)
      .getValues();

    for (let i = 0; i < salesOrderData.length; i++) {

      const row = salesOrderData[i];

      if (String(row[0]).trim() === soNo) {
        salesOrderDestination = row[7];
        soType = row[30];
        salesOrderPartyName = row[35];
        break;
      }

    }

    //---------------------------------
    // DO Form lookup
    //---------------------------------

    let billPort = "";

    const doFormData = doFormSheet
      .getRange(2, 2, doFormSheet.getLastRow() - 1, 21)
      .getValues();

    for (let i = 0; i < doFormData.length; i++) {

      const row = doFormData[i];

      if (String(row[0]).trim() === doNo) {
        billPort = row[20];
        break;
      }

    }

    //---------------------------------
    // Return object
    //---------------------------------

    return JSON.parse(JSON.stringify({

      inNo: inNo,

      inTime: selectedRow[CONFIG.COL_INTIME - 1]
        ? Utilities.formatDate(
          new Date(selectedRow[CONFIG.COL_INTIME - 1]),
          Session.getScriptTimeZone(),
          "dd-MMM-yyyy HH:mm"
        )
        : "",

      outTime: selectedRow[CONFIG.COL_OUTTIME - 1]
        ? Utilities.formatDate(
          new Date(selectedRow[CONFIG.COL_OUTTIME - 1]),
          Session.getScriptTimeZone(),
          "dd-MMM-yyyy HH:mm"
        )
        : "",

      party: selectedRow[CONFIG.COL_PARTY - 1],
      from: selectedRow[CONFIG.COL_FROM - 1],
      destination: selectedRow[CONFIG.COL_DESTINATION - 1],
      truck: selectedRow[CONFIG.COL_TRUCK - 1],
      transporter: selectedRow[CONFIG.COL_TRANSPORTER - 1],
      trasnportPurchaseRate: selectedRow[CONFIG.COL_TRANSPORTPURCHASERATE - 1],
      trader: selectedRow[CONFIG.COL_TRADER - 1],
      vesselName: selectedRow[CONFIG.COL_VESSELNAME - 1],
      sealNo: selectedRow[CONFIG.COL_SEALNO - 1],
      grossWeight: String(selectedRow[CONFIG.COL_GROSSWEIGHT - 1]),
      tareWeight: String(selectedRow[CONFIG.COL_TAREWEIGHT - 1]),
      netWeight: String(selectedRow[CONFIG.COL_NET_WEIGHT - 1]),
      term: String(selectedRow[CONFIG.COL_TERM - 1]),

      soNo: soNo,
      pdo: pdo,
      doNo: doNo,

      soType: soType,
      tallyVesselName: tallyVesselName,
      handlingRate: handlingRate || "0",

      salesOrderPartyName: salesOrderPartyName,
      salesOrderDestination: salesOrderDestination,
      billPort: billPort

    }));

  }
  catch (err) {
    Logger.log(err);
    return null;
  }

}

/***********************************************************
 *  CREATE BILL
 ***********************************************************/
function createBill(inNo, billNo, billBy) {

  const email = Session.getActiveUser().getEmail();
  const user = getCurrentUser();

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(30000);

    const ss = SpreadsheetApp.openById(CONFIG.TRIAL_BILL_SS_ID);
    const submitSheet = ss.getSheetByName(CONFIG.BILL_SUBMIT_SHEET);

    const lastRow = submitSheet.getLastRow();

    if (lastRow > 1) {

      const existing = submitSheet
        .getRange(2, 2, lastRow - 1, 2)
        .getValues();

      const billedSet = new Set(
        existing.map(r => String(r[0]).trim())
      );

      const billNoSet = new Set(
        existing.map(r => String(r[1]).trim())
      );

      if (billedSet.has(String(inNo).trim())) {
        return { success: false, message: "A bill already exists for this IN number." };
      }

      if (billNoSet.has(String(billNo).trim())) {
        return { success: false, message: "This bilty number has already been used." };
      }

    }

    submitSheet.appendRow([
      new Date(),
      inNo,
      billNo,
      user.name,
      email,
      generateUID()
    ]);

    return { success: true, message: "Bill created successfully." };

  }
  catch (e) {
    return { success: false, message: e.toString() };
  }
  finally {
    try { lock.releaseLock(); } catch (e) { }
  }

}

/***********************************************************
 *  LAST 100 SUBMITTED BILLS
 ***********************************************************/
function getRecentBills() {

  const ss = SpreadsheetApp.openById(CONFIG.TRIAL_BILL_SS_ID);
  const submitSheet = ss.getSheetByName(CONFIG.BILL_SUBMIT_SHEET);

  const lastRow = submitSheet.getLastRow();

  if (lastRow <= 1) return [];

  const numRows = lastRow - 1;
  const startRow = Math.max(2, lastRow - 99); // last 100 rows
  const fetchCount = lastRow - startRow + 1;

  const data = submitSheet
    .getRange(startRow, 1, fetchCount, 6)
    .getValues();

  let bills = data.map(row => ({
    date: row[0]
      ? Utilities.formatDate(
        new Date(row[0]),
        Session.getScriptTimeZone(),
        "dd-MMM-yyyy HH:mm"
      )
      : "",
    inNo: String(row[1]).trim(),
    billNo: String(row[2]).trim(),
    billBy: row[3],
    email: row[4],
    uid: row[5]
  }));

  // Most recent first
  bills.reverse();

  return bills;

}

/***********************************************************
 *  UTILITY
 ***********************************************************/
function generateUID() {
  return Utilities.getUuid();
}
