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
var LINE_WIDTH = parseInt(process.env.LINE_WIDTH || "40", 10);

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
  if (serviceMode === "delivery") return "LIVRAISON";
  if (serviceMode === "pickup") return "A EMPORTER";
  if (serviceMode === "dine_in") return "SUR PLACE";
  return "NON DEFINI";
}

function formatDate(dateValue) {
  var date = new Date(dateValue);
  try {
    var fmt = new Intl.DateTimeFormat("fr-FR", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    if (fmt.formatToParts) {
      var p = {};
      fmt.formatToParts(date).forEach(function (part) { p[part.type] = part.value; });
      return p.day + "/" + p.month + "/" + p.year + " - " + p.hour + ":" + p.minute;
    }
    return fmt.format(date);
  } catch (_err) {
    try {
      var fmt2 = new Intl.DateTimeFormat("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      if (fmt2.formatToParts) {
        var p2 = {};
        fmt2.formatToParts(date).forEach(function (part) { p2[part.type] = part.value; });
        return p2.day + "/" + p2.month + "/" + p2.year + " - " + p2.hour + ":" + p2.minute;
      }
      return fmt2.format(date);
    } catch (_err2) {
      return date.toLocaleString();
    }
  }
}

function repeat(char, n) {
  var s = "";
  for (var i = 0; i < n; i++) s += char;
  return s;
}

function divider() {
  return repeat("-", LINE_WIDTH);
}

function dashedDivider() {
  var s = "";
  for (var i = 0; i < LINE_WIDTH; i++) s += (i % 2 === 0 ? "-" : " ");
  return s;
}

function center(text) {
  var t = String(text || "");
  if (t.length >= LINE_WIDTH) return t;
  var left = Math.floor((LINE_WIDTH - t.length) / 2);
  return repeat(" ", left) + t;
}

function rightAlign(label, value) {
  var l = String(label || "");
  var v = String(value || "");
  var spaces = LINE_WIDTH - l.length - v.length;
  if (spaces < 1) spaces = 1;
  return l + repeat(" ", spaces) + v;
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
    dashedDivider(),
    center("KITCHEN TICKET"),
    center("Commande #" + order.id),
    dashedDivider(),
    center(mode),
    dashedDivider(),
  ];

  items.forEach(function (item) {
    lines.push(item.quantity + " x " + item.name);
    item.options.forEach(function (opt) {
      opt = opt || {};
      var extra = Number(safeGet(opt, "extraPrice", 0));
      var extraText = extra > 0 ? " (+" + money(extra) + " MAD)" : "";
      lines.push("  + " + String(safeGet(opt, "name", "")) + extraText);
    });
  });

  lines.push(
    dashedDivider(),
    "Client : " + order.customer_name,
    "Tel    : " + order.customer_phone,
    formatDate(order.created_at),
    "", "", "", ""
  );
  return lines.join("\r\n");
}

function buildReceiptTicket(order) {
  var orderMeta = order.order_meta || {};
  var mode = normalizeServiceMode(orderMeta.serviceMode);
  var items = parseItems(order.items);
  var subtotal = Number(safeGet(orderMeta, "subtotal", 0));
  var deliveryFee = Number(safeGet(orderMeta, "deliveryFee", 0));
  var total = Number(order.total || 0);

  var lines = [
    center("FACEBURGER"),
    center("RECU CLIENT"),
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

  lines.push(divider());

  items.forEach(function (item) {
    lines.push(item.quantity + " x " + item.name);
    item.options.forEach(function (opt) {
      opt = opt || {};
      var extra = Number(safeGet(opt, "extraPrice", 0));
      var extraText = extra > 0 ? " (+" + money(extra) + " MAD)" : "";
      lines.push("  + " + String(safeGet(opt, "name", "")) + extraText);
    });
    lines.push(rightAlign("", money(item.lineTotal) + " MAD"));
    lines.push("");
  });

  lines.push(divider());
  lines.push(rightAlign("Sous-total :", money(subtotal) + " MAD"));
  if (deliveryFee > 0) {
    lines.push(rightAlign("Livraison  :", money(deliveryFee) + " MAD"));
  }
  lines.push(rightAlign("TOTAL TTC  :", money(total) + " MAD"));
  lines.push(divider());
  lines.push(center("Merci de votre visite !"));
  lines.push("", "", "", "");
  return lines.join("\r\n");
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
    child.stderr.on("data", function (chunk) { stderr += chunk.toString(); });
    child.stdout.on("data", function (chunk) { stdout += chunk.toString(); });

    child.on("close", function (code) {
      if (code === 0) resolve();
      else reject(new Error((stderr + stdout).trim() || "PowerShell exited with code " + code));
    });

    child.on("error", reject);
  });
}

function runCmdPrint(filePath) {
  return new Promise(function (resolve, reject) {
    var safePrinter = PRINTER_NAME.replace(/"/g, "");
    var safePath = filePath.replace(/"/g, "");
    var cmdline = 'cmd /c print /D:"' + safePrinter + '" "' + safePath + '"';
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

  var escapedPath = filePath.replace(/'/g, "''");
  var escapedPrinter = PRINTER_NAME.replace(/'/g, "''");
  var psCommand =
    "[System.IO.File]::ReadAllText('" + escapedPath + "') | Out-Printer -Name '" + escapedPrinter + "'";

  try {
    try {
      await runPowerShell(psCommand);
    } catch (psErr) {
      var msg = psErr && psErr.message ? psErr.message : String(psErr);
      console.error("[printer-listener] Out-Printer failed, trying PRINT.EXE:", msg);
      await runCmdPrint(filePath);
    }
  } finally {
    try { await fs.unlink(filePath); } catch (_err) {}
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
    try { order.items = JSON.parse(order.items); } catch (_e) { order.items = []; }
  }
  if (order && typeof order.order_meta === "string") {
    try { order.order_meta = JSON.parse(order.order_meta); } catch (_e) { order.order_meta = {}; }
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
  console.log("[printer-listener] Line width: " + LINE_WIDTH + " chars");

  await tick();
  setInterval(tick, POLL_MS);
}

main().catch(function (error) {
  console.error("[printer-listener] Fatal error:", error);
  process.exit(1);
});
