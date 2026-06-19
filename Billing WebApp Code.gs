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
  CLAIMS_SHEET: "Claims",
  BILLER_SHEET: "Biller",

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
  if (!isAuthorizedUser()) {
    return HtmlService.createHtmlOutput(
      "<h2>Access Denied</h2><p>You are not authorized to use this application.</p>"
    );
  }

  return HtmlService
    .createTemplateFromFile("Billing Dashboard Page")
    .evaluate()
    .setTitle("Bill Management — Rawalwasia")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/***********************************************************
 *  AUTHORIZED USER ACCES  ONLY
 ***********************************************************/
function isAuthorizedUser() {

  const email = Session.getActiveUser().getEmail().toLowerCase();

  const values = Sheets.Spreadsheets.Values.get(
    CONFIG.TRIAL_BILL_SS_ID,
    `${CONFIG.BILLER_SHEET}!G2:G`
  ).values || [];

  const allowedUsers = new Set(
    values.flat().map(e => String(e).toLowerCase().trim())
  );

  return allowedUsers.has(email);

}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/***********************************************************
 *  CURRENT USER
 ***********************************************************/
function getCurrentUser() {

  const email = Session.getActiveUser().getEmail().toLowerCase();

  try {

    const cache = CacheService.getScriptCache();

    let userMap = cache.get("userMap");

    if (userMap) {

      userMap = JSON.parse(userMap);

    } else {

      const response = Sheets.Spreadsheets.Values.get(
        CONFIG.TRIAL_BILL_SS_ID,
        `${CONFIG.USER_SHEET}!A:B`
      );

      const values = response.values || [];

      userMap = {};

      // Skip header
      for (let i = 1; i < values.length; i++) {

        const rowEmail = String(values[i][0] || "")
          .trim()
          .toLowerCase();

        const rowName = String(values[i][1] || "").trim();

        if (rowEmail) {

          userMap[rowEmail] = rowName;

        }

      }

      // Cache for 6 hours
      cache.put(
        "userMap",
        JSON.stringify(userMap),
        21600
      );

    }

    return {

      email: email,

      name:
        userMap[email] ||
        email.split("@")[0]

    };

  }
  catch (err) {

    Logger.log(err);

    return {

      email: email,
      name: email.split("@")[0]

    };

  }

}

/***********************************************************
 *  CLAIMS — helpers
 ***********************************************************/

/** Get or create the Claims sheet */
function getClaimsData_() {

  try {

    const res = Sheets.Spreadsheets.Values.get(
      CONFIG.CLAIMS_SS_ID,
      `${CONFIG.CLAIMS_SHEET}!A:D`
    );

    return res.values || [];

  } catch (e) {

    // Create header if sheet is empty/not found
    Sheets.Spreadsheets.Values.update(
      {
        values: [["Timestamp", "IN No", "User Name", "Email"]]
      },
      CONFIG.CLAIMS_SS_ID,
      `${CONFIG.CLAIMS_SHEET}!A1`,
      { valueInputOption: "RAW" }
    );

    return [["Timestamp", "IN No", "User Name", "Email"]];

  }

}

/**
 * Remove all rows where:
 *  - the claim has expired (> CLAIM_TTL_MS old), OR
 *  - the IN number matches AND the email matches (user releasing their own claim)
 */
function saveClaims_(rows) {

  Sheets.Spreadsheets.Values.clear(
    {},
    CONFIG.CLAIMS_SS_ID,
    `${CONFIG.CLAIMS_SHEET}!A:D`
  );

  Sheets.Spreadsheets.Values.update(
    {
      values: rows
    },
    CONFIG.CLAIMS_SS_ID,
    `${CONFIG.CLAIMS_SHEET}!A1`,
    {
      valueInputOption: "RAW"
    }
  );

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

    const values = getClaimsData_();

    const header = values[0] || [
      "Timestamp",
      "IN No",
      "User Name",
      "Email"
    ];

    const now = Date.now();

    let claims = values.slice(1);

    // Remove expired claims
    claims = claims.filter(r => {

      const ts = r[0] ? new Date(r[0]).getTime() : 0;

      return (now - ts) <= CONFIG.CLAIM_TTL_MS;

    });

    for (let i = 0; i < claims.length; i++) {

      const rowInNo = String(claims[i][1]).trim();
      const rowName = String(claims[i][2]).trim();
      const rowEmail = String(claims[i][3]).trim();
      const rowTs = claims[i][0]
        ? new Date(claims[i][0]).getTime()
        : 0;

      if (rowInNo !== inNo) continue;

      // Another user owns it
      if (rowEmail !== user.email) {

        const ageSec = Math.floor((now - rowTs) / 1000);

        const agoStr =
          ageSec < 60
            ? ageSec + "s ago"
            : Math.floor(ageSec / 60) + "m ago";

        return {
          claimed: true,
          by: rowName,
          since: agoStr
        };

      }

      // Same user → refresh timestamp
      claims[i][0] = new Date().toISOString();

      saveClaims_([header, ...claims]);

      return { claimed: false };

    }

    // New claim
    claims.push([
      new Date().toISOString(),
      inNo,
      user.name,
      user.email
    ]);

    saveClaims_([header, ...claims]);

    return { claimed: false };

  }
  catch (e) {

    Logger.log(e);
    return { claimed: false };

  }
  finally {

    try {
      lock.releaseLock();
    } catch (e) { }

  }

}

/***********************************************************
 *  releaseClaim — called when user deselects, submits,
 *  or the page unloads (navigator.sendBeacon)
 ***********************************************************/
function releaseClaim(inNo) {

  const user = getCurrentUser();

  try {

    const values = getClaimsData_();

    if (values.length <= 1) return;

    const header = values[0];

    const rows = values.slice(1);

    const now = Date.now();

    const filtered = rows.filter(r => {

      const ts = r[0]
        ? new Date(r[0]).getTime()
        : 0;

      const expired =
        (now - ts) > CONFIG.CLAIM_TTL_MS;

      const ownClaim =
        String(r[1]).trim() === String(inNo).trim() &&
        String(r[3]).trim() === user.email;

      return !(expired || ownClaim);

    });

    saveClaims_([header, ...filtered]);

  }
  catch (e) {

    Logger.log(e);

  }

}

/***********************************************************
 *  checkBiltyExists — lightweight as-you-type check
 *  Returns { exists: bool, inNo: string|null }
 ***********************************************************/
function checkBiltyExists(billNo) {

  if (!billNo || !billNo.trim()) {
    return {
      exists: false,
      inNo: null
    };
  }

  try {

    const response = Sheets.Spreadsheets.Values.get(
      CONFIG.TRIAL_BILL_SS_ID,
      `${CONFIG.BILL_SUBMIT_SHEET}!B109216:C`
    );

    const data = response.values || [];
    const needle = String(billNo).trim().toLowerCase();

    for (const row of data) {

      const inNo = String(row[0] || "").trim();
      const existingBillNo = String(row[1] || "").trim().toLowerCase();

      if (existingBillNo === needle) {

        return {
          exists: true,
          inNo: inNo
        };

      }

    }

    return {
      exists: false,
      inNo: null
    };

  }
  catch (err) {

    Logger.log(err);

    return {
      exists: false,
      inNo: null
    };

  }

}

/***********************************************************
 *  PENDING BILLS
 ***********************************************************/
function getPendingBills() {

  try {

    // ───────────────── Dispatch Data ─────────────────
    const dispatchData =
      Sheets.Spreadsheets.Values.get(
        CONFIG.DISPATCH_SS_ID,
        `${CONFIG.DISPATCH_SHEET}!A42000:AF`
      ).values || [];

    // ───────────────── Submitted Bills ─────────────────
    let billedSet = new Set();

    try {

      const submitData =
        Sheets.Spreadsheets.Values.get(
          CONFIG.TRIAL_BILL_SS_ID,
          `${CONFIG.BILL_SUBMIT_SHEET}!B100000:B`
        ).values || [];

      billedSet = new Set(
        submitData
          .flat()
          .map(x => String(x).trim())
          .filter(String)
      );

    } catch (e) {
      Logger.log(e);
    }

    // ───────────────── Live Claims ─────────────────
    let claimsMap = {};

    try {

      const claimSheet = getClaimsSheet_();

      const claimLast = claimSheet.getLastRow();

      if (claimLast > 1) {

        const cData = claimSheet
          .getRange(2, 1, claimLast - 1, 4)
          .getValues();

        const now = Date.now();

        cData.forEach(r => {

          const ts =
            r[0]
              ? new Date(r[0]).getTime()
              : 0;

          const rowInNo = String(r[1] || "").trim();
          const rowName = String(r[2] || "").trim();

          if (
            rowInNo &&
            (now - ts) <= CONFIG.CLAIM_TTL_MS
          ) {

            claimsMap[rowInNo] = rowName;

          }

        });

      }

    } catch (e) {
      Logger.log(e);
    }

    // ───────────────── Pending List ─────────────────
    let pending = [];

    for (let i = 0; i < dispatchData.length; i++) {

      const row = dispatchData[i];

      const inNo = String(
        row[CONFIG.COL_IN_NO - 1] || ""
      ).trim();

      const outTime =
        row[CONFIG.COL_OUTTIME - 1];

      const remarks = String(
        row[CONFIG.COL_REMARKS - 1] || ""
      ).trim();

      if (
        inNo &&
        outTime &&
        remarks !== "Cancel Entry" &&
        !billedSet.has(inNo)
      ) {

        pending.push({

          inNo: inNo,

          party:
            row[CONFIG.COL_PARTY - 1] || "",

          truck:
            row[CONFIG.COL_TRUCK - 1] || "",

          outTime: outTime
            ? Utilities.formatDate(
              new Date(outTime),
              Session.getScriptTimeZone(),
              "dd-MMM-yyyy HH:mm"
            )
            : "",

          claimedBy:
            claimsMap[inNo] || null

        });

      }

    }

    // Most recent first
    pending.reverse();

    return pending;

  } catch (err) {

    Logger.log(err);

    return [];

  }

}

function refreshPendingBills() {
  return getPendingBills();
}

/***********************************************************
 *  BILL DETAILS FOR A SINGLE IN NUMBER
 ***********************************************************/
function getBillDetails(inNo) {

  try {

    const startRow = 42000;

    // ───────────────── Dispatch Sheet ─────────────────
    const dispatchData =
      Sheets.Spreadsheets.Values.get(
        CONFIG.DISPATCH_SS_ID,
        `${CONFIG.DISPATCH_SHEET}!A${startRow}:AF`
      ).values || [];

    let selectedRow = null;

    for (let i = 0; i < dispatchData.length; i++) {

      const row = dispatchData[i];

      if (
        String(row[CONFIG.COL_IN_NO - 1] || "").trim() ===
        String(inNo).trim()
      ) {

        selectedRow = row;
        break;

      }

    }

    if (!selectedRow) return null;

    const soNo = String(
      selectedRow[CONFIG.COL_SONO - 1] || ""
    ).trim();

    const pdo = String(
      selectedRow[CONFIG.COL_PDO - 1] || ""
    ).trim();

    const doNo = String(
      selectedRow[CONFIG.COL_DONO - 1] || ""
    ).trim();

    // ───────────────── Sheet23 ─────────────────
    let tallyVesselName = "";
    let handlingRate = "";

    const sheet23Data =
      Sheets.Spreadsheets.Values.get(
        CONFIG.VESSEL_SS_ID,
        "Sheet23!A:O"
      ).values || [];

    for (let i = 1; i < sheet23Data.length; i++) {

      const row = sheet23Data[i];

      if (String(row[0] || "").trim() !== pdo) continue;

      if (soNo.startsWith("RMPL")) {
        tallyVesselName = String(row[12] || "").trim();
      }
      else if (soNo.startsWith("GLBL")) {
        tallyVesselName = String(row[13] || "").trim();
      }
      else if (soNo.startsWith("OTHR")) {
        tallyVesselName = String(row[14] || "").trim();
      }
      else {
        tallyVesselName = String(row[4] || "").trim();
      }

      break;

    }

    // Handling rate
    for (let i = 1; i < sheet23Data.length; i++) {

      const row = sheet23Data[i];

      if (
        String(row[4] || "").trim() === tallyVesselName
      ) {

        handlingRate = row[6] || "0";
        break;

      }

    }

    // ───────────────── Sales Order ─────────────────
    let soType = "";
    let salesOrderDestination = "";
    let salesOrderPartyName = "";

    const salesOrderData =
      Sheets.Spreadsheets.Values.get(
        CONFIG.SALES_ORDER_SS_ID,
        `${CONFIG.SALES_ORDER_SHEET}!B:AK`
      ).values || [];

    for (let i = 1; i < salesOrderData.length; i++) {

      const row = salesOrderData[i];

      if (
        String(row[0] || "").trim() === soNo
      ) {

        salesOrderDestination = row[7] || "";
        soType = row[30] || "";
        salesOrderPartyName = row[35] || "";

        break;

      }

    }

    // ───────────────── DO Form ─────────────────
    let billPort = "";

    const doFormData =
      Sheets.Spreadsheets.Values.get(
        CONFIG.SALES_ORDER_SS_ID,
        `${CONFIG.DO_FORM_SHEET}!B:V`
      ).values || [];

    for (let i = 1; i < doFormData.length; i++) {

      const row = doFormData[i];

      if (
        String(row[0] || "").trim() === doNo
      ) {

        billPort = row[20] || "";
        break;

      }

    }

    // ───────────────── Return Object ─────────────────
    return JSON.parse(JSON.stringify({

      inNo: inNo,

      inTime: selectedRow[CONFIG.COL_INTIME - 1] || "",
      outTime: selectedRow[CONFIG.COL_OUTTIME - 1] || "",

      party: selectedRow[CONFIG.COL_PARTY - 1] || "",
      from: selectedRow[CONFIG.COL_FROM - 1] || "",
      destination: selectedRow[CONFIG.COL_DESTINATION - 1] || "",
      truck: selectedRow[CONFIG.COL_TRUCK - 1] || "",
      transporter: selectedRow[CONFIG.COL_TRANSPORTER - 1] || "",
      trasnportPurchaseRate:
        selectedRow[CONFIG.COL_TRANSPORTPURCHASERATE - 1] || "",

      trader: selectedRow[CONFIG.COL_TRADER - 1] || "",
      vesselName: selectedRow[CONFIG.COL_VESSELNAME - 1] || "",
      sealNo: selectedRow[CONFIG.COL_SEALNO - 1] || "",

      grossWeight: String(
        selectedRow[CONFIG.COL_GROSSWEIGHT - 1] || ""
      ),

      tareWeight: String(
        selectedRow[CONFIG.COL_TAREWEIGHT - 1] || ""
      ),

      netWeight: String(
        selectedRow[CONFIG.COL_NET_WEIGHT - 1] || ""
      ),

      term: String(
        selectedRow[CONFIG.COL_TERM - 1] || ""
      ),

      soNo: soNo,
      pdo: pdo,
      doNo: doNo,

      soType: soType,
      tallyVesselName: tallyVesselName,
      handlingRate: handlingRate,

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

    // Read existing IN + Bill No using Sheets API
    const existingData =
      Sheets.Spreadsheets.Values.get(
        CONFIG.TRIAL_BILL_SS_ID,
        `${CONFIG.BILL_SUBMIT_SHEET}!B100000:C`
      ).values || [];

    const billedSet = new Set();
    const billNoSet = new Set();

    existingData.forEach(row => {

      billedSet.add(
        String(row[0] || "").trim()
      );

      billNoSet.add(
        String(row[1] || "").trim()
      );

    });

    if (billedSet.has(String(inNo).trim())) {

      return {
        success: false,
        message: "A bill already exists for this IN number."
      };

    }

    if (billNoSet.has(String(billNo).trim())) {

      return {
        success: false,
        message: "This bilty number has already been used."
      };

    }

    // Write using SpreadsheetApp
    const ss = SpreadsheetApp.openById(
      CONFIG.TRIAL_BILL_SS_ID
    );

    const submitSheet =
      ss.getSheetByName(
        CONFIG.BILL_SUBMIT_SHEET
      );

    submitSheet.appendRow([
      new Date(),
      inNo,
      billNo,
      user.name,
      email,
      generateUID()
    ]);

    // Release claim after successful bill creation
    try {
      releaseClaim(inNo);
    } catch (e) { }

    return {
      success: true,
      message: "Bill created successfully."
    };

  }
  catch (e) {

    return {
      success: false,
      message: e.toString()
    };

  }
  finally {

    try {
      lock.releaseLock();
    }
    catch (e) { }

  }

}

/***********************************************************
 *  LAST 100 SUBMITTED BILLS
 ***********************************************************/
function getRecentBills() {

  try {

    const meta = Sheets.Spreadsheets.get(
      CONFIG.TRIAL_BILL_SS_ID,
      { fields: "sheets(properties(title,gridProperties(rowCount)))" }
    );

    const sheetInfo = meta.sheets.find(
      s => s.properties.title === CONFIG.BILL_SUBMIT_SHEET
    );

    const lastRow = sheetInfo.properties.gridProperties.rowCount;

    const startRow = Math.max(2, lastRow - 99);

    const response = Sheets.Spreadsheets.Values.get(
      CONFIG.TRIAL_BILL_SS_ID,
      `${CONFIG.BILL_SUBMIT_SHEET}!A${startRow}:F${lastRow}`
    );

    const data = (response.values || []).reverse();

    return data.map(row => ({
      date: row[0]
        ? Utilities.formatDate(
          new Date(row[0]),
          Session.getScriptTimeZone(),
          "dd-MMM-yyyy HH:mm"
        )
        : "",
      inNo: String(row[1] || "").trim(),
      billNo: String(row[2] || "").trim(),
      billBy: String(row[3] || "").trim(),
      email: String(row[4] || "").trim(),
      uid: String(row[5] || "").trim()
    }));

  } catch (err) {

    Logger.log(err);
    return [];

  }

}

/***********************************************************
 *  CHALLAN DATA
 *  Returns all fields needed to render a Delivery Challan.
 *  Looks up the submitted bill for billNo, then enriches
 *  with dispatch data + sales order party address.
 ***********************************************************/
function getChallanData(inNo) {

  try {

    //────────────────────────────
    // 1. Dispatch Data
    //────────────────────────────
    const dispatchResponse = Sheets.Spreadsheets.Values.get(
      CONFIG.DISPATCH_SS_ID,
      `${CONFIG.DISPATCH_SHEET}!A40000:AF`
    );

    const dispatchData = dispatchResponse.values || [];

    let dispatchRow = null;

    for (const row of dispatchData) {

      if (
        String(row[CONFIG.COL_IN_NO - 1] || "").trim() ===
        String(inNo).trim()
      ) {
        dispatchRow = row;
        break;
      }

    }

    if (!dispatchRow) {

      return {
        error: "Dispatch record not found for IN : " + inNo
      };

    }


    //────────────────────────────
    // 2. Bill Submit Data
    //────────────────────────────
    const submitResponse = Sheets.Spreadsheets.Values.get(
      CONFIG.TRIAL_BILL_SS_ID,
      `${CONFIG.BILL_SUBMIT_SHEET}!A109216:D`
    );

    const submitData = submitResponse.values || [];

    let billNo = "";
    let billDate = "";

    for (const row of submitData) {

      if (
        String(row[1] || "").trim() === String(inNo).trim()
      ) {

        billNo = String(row[2] || "").trim();

        billDate = row[0]
          ? Utilities.formatDate(
            new Date(row[0]),
            Session.getScriptTimeZone(),
            "dd-MMM-yyyy"
          )
          : "";

        break;

      }

    }


    //────────────────────────────
    // 3. Destination Address
    //────────────────────────────
    let destination = String(
      dispatchRow[CONFIG.COL_DESTINATION - 1] || ""
    ).trim();

    let fromLocation = String(
      dispatchRow[CONFIG.COL_FROM - 1] || ""
    ).trim()

    let partyAddress = "";
    let portState = "";
    let portPincode = "";

    try {

      const billerResponse = Sheets.Spreadsheets.Values.get(
        CONFIG.TRIAL_BILL_SS_ID,
        `${CONFIG.BILLER_SHEET}!B:F`
      );

      const billerData = billerResponse.values || [];
      // Party Address lookup From biller Sheet
      for (const row of billerData) {
        if (
          String(row[3] || "").trim() === destination
        ) {
          partyAddress = String(row[4] || "").trim();
          break;
        }
      }

      // Pin Cose and State lookup From biller Sheet
      for (const row of billerData) {
        if (
          String(row[0] || "").trim() === fromLocation
        ) {
          portState = String(row[2] || "").trim();
          portPincode = String(row[1] || "").trim();
          break;
        }
      }
    }
    catch (e) {

      Logger.log("Address lookup failed : " + e);

    }


    //────────────────────────────
    // Return Object
    //────────────────────────────
    return {

      inNo: inNo,

      billNo: billNo || "—",

      billDate:
        billDate ||
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          "dd-MMM-yyyy"
        ),

      partyName: String(
        dispatchRow[CONFIG.COL_PARTY - 1] || ""
      ).trim(),

      partyAddress: partyAddress,

      truckNo: String(
        dispatchRow[CONFIG.COL_TRUCK - 1] || ""
      ).trim(),

      fromLocation: fromLocation,

      destination: destination,

      grossWeight: String(
        dispatchRow[CONFIG.COL_GROSSWEIGHT - 1] || ""
      ).trim(),

      tareWeight: String(
        dispatchRow[CONFIG.COL_TAREWEIGHT - 1] || ""
      ).trim(),

      netWeight: String(
        dispatchRow[CONFIG.COL_NET_WEIGHT - 1] || ""
      ).trim(),

      vesselName: String(
        dispatchRow[CONFIG.COL_VESSELNAME - 1] || ""
      ).trim(),

      // ticketNo: String(inNo).replace(/\D/g, ""), // numeric part only

      // inDate: dispatchRow[CONFIG.COL_INTIME - 1]
      //   ? Utilities.formatDate(
      //     new Date(dispatchRow[CONFIG.COL_INTIME - 1]),
      //     Session.getScriptTimeZone(),
      //     "dd-MM-yyyy"
      //   )
      //   : "",

      // inTime: dispatchRow[CONFIG.COL_INTIME - 1]
      //   ? Utilities.formatDate(
      //     new Date(dispatchRow[CONFIG.COL_INTIME - 1]),
      //     Session.getScriptTimeZone(),
      //     "HH:mm:ss"
      //   )
      //   : "",

      // outDate: dispatchRow[CONFIG.COL_OUTTIME - 1]
      //   ? Utilities.formatDate(
      //     new Date(dispatchRow[CONFIG.COL_OUTTIME - 1]),
      //     Session.getScriptTimeZone(),
      //     "dd-MM-yyyy"
      //   )
      //   : "",

      // outTime: dispatchRow[CONFIG.COL_OUTTIME - 1]
      //   ? Utilities.formatDate(
      //     new Date(dispatchRow[CONFIG.COL_OUTTIME - 1]),
      //     Session.getScriptTimeZone(),
      //     "HH:mm:ss"
      //   )
      //   : "",

      // grossWeightKg: Number(dispatchRow[CONFIG.COL_GROSSWEIGHT - 1]) * 1000,

      // tareWeightKg: Number(dispatchRow[CONFIG.COL_TAREWEIGHT - 1]) * 1000,

      // netWeightKg: Number(dispatchRow[CONFIG.COL_NET_WEIGHT - 1]) * 1000,

      // netWeightWords: convertNumberToWords(
      //   Math.round(Number(dispatchRow[CONFIG.COL_NET_WEIGHT - 1]) * 1000)
      // )

    };

  }
  catch (err) {

    Logger.log(err);

    return {
      error: err.toString()
    };

  }

}

/***********************************************************
 *  ALL BILLED IN NUMBERS (for challan dropdown)
 *  Returns list of {inNo, billNo, billDate, party} for
 *  every IN that has a submitted bill.
 ***********************************************************/
function getBilledINList() {

  try {

    // -------------------------------
    // Bill Submit (last 100 records)
    // -------------------------------
    const billMeta = Sheets.Spreadsheets.get(
      CONFIG.TRIAL_BILL_SS_ID,
      { fields: "sheets(properties(title,gridProperties(rowCount)))" }
    );

    const billSheetInfo = billMeta.sheets.find(
      s => s.properties.title === CONFIG.BILL_SUBMIT_SHEET
    );

    const lastRow = billSheetInfo.properties.gridProperties.rowCount;

    const startRow = Math.max(109216, lastRow - 99);

    if (lastRow < startRow) return [];

    const submitResponse = Sheets.Spreadsheets.Values.get(
      CONFIG.TRIAL_BILL_SS_ID,
      `${CONFIG.BILL_SUBMIT_SHEET}!A${startRow}:D${lastRow}`
    );

    const submitData = submitResponse.values || [];



    // -------------------------------
    // Dispatch data (42000 onwards)
    // -------------------------------
    const dispatchResponse = Sheets.Spreadsheets.Values.get(
      CONFIG.DISPATCH_SS_ID,
      `${CONFIG.DISPATCH_SHEET}!A42000:AF`
    );

    const dispatchData = dispatchResponse.values || [];



    // -------------------------------
    // Build IN → Party map
    // -------------------------------
    const partyMap = {};

    dispatchData.forEach(row => {

      const inNo = String(
        row[CONFIG.COL_IN_NO - 1] || ""
      ).trim();

      const party = String(
        row[CONFIG.COL_PARTY - 1] || ""
      ).trim();

      if (inNo) {
        partyMap[inNo] = party;
      }

    });



    // -------------------------------
    // Build result
    // -------------------------------
    return submitData
      .filter(r => String(r[1] || "").trim())
      .map(r => ({

        billDate: r[0]
          ? Utilities.formatDate(
            new Date(r[0]),
            Session.getScriptTimeZone(),
            "dd-MMM-yyyy"
          )
          : "",

        inNo: String(r[1] || "").trim(),

        billNo: String(r[2] || "").trim(),

        party: partyMap[
          String(r[1] || "").trim()
        ] || ""

      }))
      .reverse();

  }
  catch (err) {

    Logger.log(err);
    return [];

  }

}

/***********************************************************
 *  WEIGHMENT SLIP DATA
 *  Returns all fields needed to render a Weighment Slip
 *  for a given dispatch IN number.
 ***********************************************************/
function getWeighmentSlipData(inNo) {

  try {

    //────────────────────────────
    // 1. Dispatch Data
    //────────────────────────────
    const dispatchResponse = Sheets.Spreadsheets.Values.get(
      CONFIG.DISPATCH_SS_ID,
      `${CONFIG.DISPATCH_SHEET}!A40000:AF`
    );

    const dispatchData = dispatchResponse.values || [];

    let dispatchRow = null;

    for (const row of dispatchData) {

      if (
        String(row[CONFIG.COL_IN_NO - 1] || "").trim() ===
        String(inNo).trim()
      ) {
        dispatchRow = row;
        break;
      }

    }

    if (!dispatchRow) {

      return {
        error: "Dispatch record not found for IN : " + inNo
      };

    }

    //────────────────────────────
    // 2. Port = From location
    //────────────────────────────
    const port = String(
      dispatchRow[CONFIG.COL_FROM - 1] || ""
    ).trim();

    //────────────────────────────
    // 3. State + Pincode lookup from Biller Sheet
    //    (same column mapping as getChallanData: B=Port, C=Pincode, D=State)
    //────────────────────────────
    let state = "";
    let pin = "";

    try {

      const billerResponse = Sheets.Spreadsheets.Values.get(
        CONFIG.TRIAL_BILL_SS_ID,
        `${CONFIG.BILLER_SHEET}!B:F`
      );

      const billerData = billerResponse.values || [];

      for (const row of billerData) {

        if (
          String(row[0] || "").trim() === port
        ) {
          pin = String(row[1] || "").trim();
          state = String(row[2] || "").trim();
          break;
        }

      }

    }
    catch (e) {
      Logger.log("Biller lookup failed : " + e);
    }

    //────────────────────────────
    // 4. Ticket No. = numeric part of IN No
    //────────────────────────────
    const ticketNo = String(inNo).replace(/\D/g, "");

    //────────────────────────────
    // 5. Weights — MT to KG (× 1000)
    //────────────────────────────
    const grossWeightKG = Number(dispatchRow[CONFIG.COL_GROSSWEIGHT - 1]) * 1000;
    const tareWeightKG = Number(dispatchRow[CONFIG.COL_TAREWEIGHT - 1]) * 1000;
    const netWeightKG = Number(dispatchRow[CONFIG.COL_NET_WEIGHT - 1]) * 1000;

    //────────────────────────────
    // 6. Date & Time — In = Gross weighment, Out = Tare weighment
    //────────────────────────────
    const grossDate = dispatchRow[CONFIG.COL_INTIME - 1]
      ? Utilities.formatDate(
        new Date(dispatchRow[CONFIG.COL_INTIME - 1]),
        Session.getScriptTimeZone(),
        "dd-MM-yyyy"
      )
      : "";

    const grossTime = dispatchRow[CONFIG.COL_INTIME - 1]
      ? Utilities.formatDate(
        new Date(dispatchRow[CONFIG.COL_INTIME - 1]),
        Session.getScriptTimeZone(),
        "HH:mm:ss"
      )
      : "";

    const tareDate = dispatchRow[CONFIG.COL_OUTTIME - 1]
      ? Utilities.formatDate(
        new Date(dispatchRow[CONFIG.COL_OUTTIME - 1]),
        Session.getScriptTimeZone(),
        "dd-MM-yyyy"
      )
      : "";

    const tareTime = dispatchRow[CONFIG.COL_OUTTIME - 1]
      ? Utilities.formatDate(
        new Date(dispatchRow[CONFIG.COL_OUTTIME - 1]),
        Session.getScriptTimeZone(),
        "HH:mm:ss"
      )
      : "";

    //────────────────────────────
    // Return Object — field names match index.html exactly
    //────────────────────────────
    return {

      inNo: inNo,

      port: port,
      state: state,
      pin: pin,

      ticketNo: ticketNo,
      commodity: "Coal",   // static — change if commodity varies per dispatch

      vehicleNo: String(
        dispatchRow[CONFIG.COL_TRUCK - 1] || ""
      ).trim(),

      grossWeightKG: grossWeightKG,
      grossDate: grossDate,
      grossTime: grossTime,

      tareWeightKG: tareWeightKG,
      tareDate: tareDate,
      tareTime: tareTime,

      netWeightKG: netWeightKG,

      netWeightWords: convertNumberToWords(
        Math.round(netWeightKG)
      )

    };

  }
  catch (err) {

    Logger.log(err);

    return {
      error: err.toString()
    };

  }

}
/***********************************************************
 *  UTILITY
 ***********************************************************/
function generateUID() {
  return Utilities.getUuid();
}

/***********************************************************
 *  CONVERTS NUMBER TO WORDS
 ***********************************************************/

function convertNumberToWords(num) {

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
    'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];

  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {

    if (n < 20) return a[n];

    if (n < 100)
      return b[Math.floor(n / 10)] +
        (n % 10 ? " " + a[n % 10] : "");

    if (n < 1000)
      return a[Math.floor(n / 100)] +
        " Hundred " +
        inWords(n % 100);

    if (n < 100000)
      return inWords(Math.floor(n / 1000)) +
        " Thousand " +
        inWords(n % 1000);

    if (n < 10000000)
      return inWords(Math.floor(n / 100000)) +
        " Lakh " +
        inWords(n % 100000);

    return inWords(Math.floor(n / 10000000)) +
      " Crore " +
      inWords(n % 10000000);
  }

  return inWords(num).replace(/\s+/g, " ").trim() + " Only";
}
