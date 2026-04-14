require("dotenv").config();

var fs = require("fs").promises;
var os = require("os");
var path = require("path");
var spawn = require("child_process").spawn;
var exec = require("child_process").exec;
var Pool = require("pg").Pool;

var DATABASE_URL = process.env.DATABASE_URL;
var PRINTER_NAME = process.env.PRINTER_NAME;
var POLL_MS = parseInt(process.env.POLL_MS || "3000", 10);
var TIMEZONE = process.env.TIMEZONE || "Africa/Casablanca";

if (!DATABASE_URL) {
  console.error("[printer-listener] Missing DATABASE_URL in .env");
  process.exit(1);
}
if (!PRINTER_NAME) {
  console.error("[printer-listener] Missing PRINTER_NAME in .env");
  process.exit(1);
}
if (process.platform !== "win32") {
  console.error("[printer-listener] This listener is intended to run on Windows.");
  process.exit(1);
}

var pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function safeGet(obj, key, fallback) {
  if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null) {
    return obj[key];
  }
  return fallback;
}

function money(value) {
  var num = Number(value || 0);
  if (!isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function normalizeServiceMode(serviceMode) {
  if (serviceMode === "delivery") return "Livraison";
  if (serviceMode === "pickup") return "A emporter";
  if (serviceMode === "dine_in") return "Sur place";
  return "Non defini";
}

function formatDate(dateValue) {
  var date = new Date(dateValue);
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (_err) {
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}

function divider() {
  return "----------------------------------------";
}

function parseItems(itemsRaw) {
  if (!Array.isArray(itemsRaw)) return [];
  return itemsRaw.map(function (it) {
    it = it || {};
    return {
      name: String(safeGet(it, "name", "")),
      quantity: Number(safeGet(it, "quantity", 0)),
      lineTotal: Number(safeGet(it, "lineTotal", 0)),
      options: Array.isArray(it.options) ? it.options : [],
    };
  });
}

function buildKitchenTicket(order) {
  var orderMeta = order.order_meta || {};
  var mode = normalizeServiceMode(orderMeta.serviceMode);
  var items = parseItems(order.items);
  var lines = [
    "KITCHEN TICKET",
    divider(),
    "Commande : #" + order.id,
    "Heure    : " + formatDate(order.created_at),
    "Service  : " + mode,
    "Client   : " + order.customer_name,
    "Tel      : " + order.customer_phone,
  ];

  if (orderMeta.serviceMode === "delivery") {
    lines.push("Adresse  : " + order.customer_address);
  }

  lines.push(divider(), "ARTICLES", divider());

  items.forEach(function (item) {
    lines.push(item.quantity + " x " + item.name);
    item.options.forEach(function (opt) {
      opt = opt || {};
      var extra = Number(safeGet(opt, "extraPrice", 0));
      var extraText = extra > 0 ? " (+" + money(extra) + " MAD)" : "";
      lines.push("  + " + String(safeGet(opt, "name", "")) + extraText);
    });
    lines.push("");
  });

  lines.push(divider(), "", "", "\f");
  return lines.join("\n");
}

function buildReceiptTicket(order) {
  var orderMeta = order.order_meta || {};
  var mode = normalizeServiceMode(orderMeta.serviceMode);
  var items = parseItems(order.items);
  var subtotal = Number(safeGet(orderMeta, "subtotal", 0));
  var deliveryFee = Number(safeGet(orderMeta, "deliveryFee", 0));
  var total = Number(order.total || 0);

  var lines = [
    "FACEBURGER",
    "RECU CLIENT",
    divider(),
    "Commande : #" + order.id,
    "Date     : " + formatDate(order.created_at),
    "Client   : " + order.customer_name,
    "Tel      : " + order.customer_phone,
    "Service  : " + mode,
  ];

  if (orderMeta.serviceMode === "delivery") {
    lines.push("Adresse  : " + order.customer_address);
  }

  lines.push(divider(), "DETAIL", divider());

  items.forEach(function (item) {
    lines.push(item.quantity + " x " + item.name);
    item.options.forEach(function (opt) {
      opt = opt || {};
      var extra = Number(safeGet(opt, "extraPrice", 0));
      var extraText = extra > 0 ? " (+" + money(extra) + " MAD)" : "";
      lines.push("  + " + String(safeGet(opt, "name", "")) + extraText);
    });
    lines.push("  = " + money(item.lineTotal) + " MAD");
    lines.push("");
  });

  lines.push(divider());
  lines.push("Sous-total : " + money(subtotal) + " MAD");
  if (deliveryFee > 0) lines.push("Livraison  : " + money(deliveryFee) + " MAD");
  lines.push("TOTAL      : " + money(total) + " MAD");
  lines.push(divider(), "Merci et a bientot !", "", "", "\f");
  return lines.join("\n");
}

function runPowerShell(command) {
  return new Promise(function (resolve, reject) {
    var child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    var stderr = "";
    var stdout = "";
    child.stderr.on("data", function (chunk) {
      stderr += chunk.toString();
    });
    child.stdout.on("data", function (chunk) {
      stdout += chunk.toString();
    });

    child.on("close", function (code) {
      if (code === 0) resolve();
      else reject(new Error((stderr + stdout).trim() || "PowerShell exited with code " + code));
    });

    child.on("error", reject);
  });
}

/** Fallback when Out-Printer is missing (PS3+) or fails — uses Windows PRINT.EXE */
function runCmdPrint(filePath) {
  return new Promise(function (resolve, reject) {
    var safePrinter = PRINTER_NAME.replace(/"/g, "");
    var safePath = filePath.replace(/"/g, "");
    var cmdline =
      'cmd /c print /D:"' + safePrinter + '" "' + safePath + '"';
    exec(cmdline, { windowsHide: true, timeout: 60000 }, function (err, stdout, stderr) {
      var out = ((stderr || "") + (stdout || "")).trim();
      if (err) {
        reject(new Error(out || (err && err.message) || String(err)));
        return;
      }
      resolve();
    });
  });
}

async function sendToPrinter(content, label) {
  var filename =
    "faceburger-" + label + "-" + Date.now() + "-" + Math.random().toString(16).slice(2) + ".txt";
  var filePath = path.join(os.tmpdir(), filename);
  await fs.writeFile(filePath, content, "utf8");

  // PS 2.0: no Get-Content -Raw. Out-Printer exists in PS 3+; on Win7 PS2 it may be missing — we fallback to PRINT.EXE.
  var escapedPath = filePath.replace(/'/g, "''");
  var escapedPrinter = PRINTER_NAME.replace(/'/g, "''");
  var psCommand =
    "[System.IO.File]::ReadAllText('" +
    escapedPath +
    "') | Out-Printer -Name '" +
    escapedPrinter +
    "'";

  try {
    try {
      await runPowerShell(psCommand);
    } catch (psErr) {
      var msg = psErr && psErr.message ? psErr.message : String(psErr);
      console.error("[printer-listener] Out-Printer path failed, trying PRINT.EXE:", msg);
      await runCmdPrint(filePath);
    }
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (_err) {
      // ignore temp cleanup errors
    }
  }
}

async function ensurePrintedAtColumn() {
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS printed_at timestamp null");
}

async function fetchPendingOrders() {
  var result = await pool.query(
    "SELECT id, customer_name, customer_phone, customer_address, items, total, order_meta, created_at FROM orders WHERE printed_at IS NULL ORDER BY created_at ASC LIMIT 20"
  );
  return result.rows;
}

async function markPrinted(orderId) {
  await pool.query("UPDATE orders SET printed_at = NOW() WHERE id = $1", [orderId]);
}

function normalizeOrderRow(order) {
  if (order && typeof order.items === "string") {
    try {
      order.items = JSON.parse(order.items);
    } catch (_e) {
      order.items = [];
    }
  }
  if (order && typeof order.order_meta === "string") {
    try {
      order.order_meta = JSON.parse(order.order_meta);
    } catch (_e) {
      order.order_meta = {};
    }
  }
  return order;
}

async function processOrder(order) {
  order = normalizeOrderRow(order);
  console.log("[printer-listener] Printing order #" + order.id + "...");
  var kitchen = buildKitchenTicket(order);
  var receipt = buildReceiptTicket(order);

  await sendToPrinter(kitchen, "kitchen-" + order.id);
  await wait(350);
  await sendToPrinter(receipt, "receipt-" + order.id);
  await markPrinted(order.id);
  console.log("[printer-listener] Printed order #" + order.id + " successfully.");
}

var busy = false;
async function tick() {
  if (busy) return;
  busy = true;

  try {
    var orders = await fetchPendingOrders();
    if (orders.length > 0) {
      console.log("[printer-listener] Found " + orders.length + " pending order(s).");
    }
    for (var i = 0; i < orders.length; i += 1) {
      var order = orders[i];
      try {
        await processOrder(order);
      } catch (error) {
        console.error("[printer-listener] Failed to print order #" + order.id + ":", error && error.message ? error.message : error);
      }
    }
  } catch (error) {
    console.error("[printer-listener] Polling error:", error && error.message ? error.message : error);
  } finally {
    busy = false;
  }
}

async function main() {
  await ensurePrintedAtColumn();
  console.log("[printer-listener] Started.");
  console.log("[printer-listener] Printer: " + PRINTER_NAME);
  console.log("[printer-listener] Poll interval: " + POLL_MS + "ms");

  await tick();
  setInterval(tick, POLL_MS);
}

main().catch(function (error) {
  console.error("[printer-listener] Fatal error:", error);
  process.exit(1);
});
