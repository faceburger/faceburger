require("dotenv").config();

var Pool = require("pg").Pool;
var escpos = require("escpos");
escpos.Windows = require("escpos-windows");

var DATABASE_URL = process.env.DATABASE_URL;
var PRINTER_NAME = process.env.PRINTER_NAME;
var POLL_MS = parseInt(process.env.POLL_MS || "3000", 10);
var TIMEZONE = process.env.TIMEZONE || "Africa/Casablanca";
var LINE_WIDTH = parseInt(process.env.LINE_WIDTH || "42", 10);

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

// ─── Utilities ────────────────────────────────────────────────────────────────

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
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

function repeat(char, n) {
  var s = "";
  for (var i = 0; i < n; i++) s += char;
  return s;
}

function rightAlign(label, value) {
  var l = String(label || "");
  var v = String(value || "");
  var spaces = LINE_WIDTH - l.length - v.length;
  if (spaces < 1) spaces = 1;
  return l + repeat(" ", spaces) + v;
}

function normalizeServiceMode(serviceMode) {
  if (serviceMode === "delivery") return "LIVRAISON";
  if (serviceMode === "pickup")   return "A EMPORTER";
  if (serviceMode === "dine_in")  return "SUR PLACE";
  return "NON DEFINI";
}

function formatDate(dateValue) {
  var date = new Date(dateValue);
  try {
    var fmt = new Intl.DateTimeFormat("fr-FR", {
      timeZone: TIMEZONE,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    if (fmt.formatToParts) {
      var p = {};
      fmt.formatToParts(date).forEach(function (part) { p[part.type] = part.value; });
      return p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute;
    }
    return fmt.format(date);
  } catch (_e) {
    return date.toLocaleString();
  }
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

// ─── Receipt Builder ──────────────────────────────────────────────────────────

function buildReceipt(printer, order) {
  var orderMeta = order.order_meta || {};
  var mode = normalizeServiceMode(orderMeta.serviceMode);
  var items = parseItems(order.items);
  var subtotal = Number(safeGet(orderMeta, "subtotal", 0));
  var deliveryFee = Number(safeGet(orderMeta, "deliveryFee", 0));
  var total = Number(order.total || 0);

  // Header
  printer
    .font("a")
    .align("ct")
    .style("bu")
    .size(2, 2)
    .text("FACEBURGER")
    .size(1, 1)
    .style("normal")
    .text("RECU CLIENT")
    .text(repeat("-", LINE_WIDTH));

  // Order info
  printer
    .align("lt")
    .text("Commande : #" + order.id)
    .text("Date     : " + formatDate(order.created_at))
    .text("Client   : " + order.customer_name)
    .text("Tel      : " + order.customer_phone)
    .text("Service  : " + mode);

  if (orderMeta.serviceMode === "delivery") {
    printer.text("Adresse  : " + order.customer_address);
  }

  printer.text(repeat("-", LINE_WIDTH));

  // Items
  items.forEach(function (item) {
    printer
      .style("b")
      .text(item.quantity + " x " + item.name)
      .style("normal");
    
    item.options.forEach(function (opt) {
      opt = opt || {};
      var extra = Number(safeGet(opt, "extraPrice", 0));
      var extraText = extra > 0 ? " (+" + money(extra) + " MAD)" : "";
      printer.text("  + " + String(safeGet(opt, "name", "")) + extraText);
    });
    
    // Price aligned to the right
    var priceStr = money(item.lineTotal) + " MAD";
    printer.align("rt").text(priceStr).align("lt");
    printer.text(""); // blank line
  });

  // Totals
  printer
    .text(repeat("-", LINE_WIDTH))
    .text(rightAlign("Sous-total :", money(subtotal) + " MAD"));

  if (deliveryFee > 0) {
    printer.text(rightAlign("Livraison  :", money(deliveryFee) + " MAD"));
  }

  printer
    .style("b")
    .text(rightAlign("TOTAL      :", money(total) + " MAD"))
    .style("normal")
    .text(repeat("-", LINE_WIDTH));

  // Footer
  printer
    .align("ct")
    .text("Merci et a bientot !")
    .feed(3)
    .cut();

  return printer;
}

// ─── Print Function ───────────────────────────────────────────────────────────

function printReceipt(order) {
  return new Promise(function (resolve, reject) {
    try {
      var device = new escpos.Windows(PRINTER_NAME);
      var printer = new escpos.Printer(device, { encoding: "CP850" });

      device.open(function (err) {
        if (err) {
          return reject(err);
        }

        try {
          buildReceipt(printer, order);
          device.close();
          resolve();
        } catch (printErr) {
          device.close();
          reject(printErr);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Database ─────────────────────────────────────────────────────────────────

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

// ─── Order Processing ─────────────────────────────────────────────────────────

async function processOrder(order) {
  order = normalizeOrderRow(order);
  console.log("[printer-listener] Printing order #" + order.id + "...");

  await printReceipt(order);
  await markPrinted(order.id);
  
  console.log("[printer-listener] Printed order #" + order.id + " successfully.");
}

// ─── Polling Loop ─────────────────────────────────────────────────────────────

var busy = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    var orders = await fetchPendingOrders();
    if (orders.length > 0) {
      console.log("[printer-listener] Found " + orders.length + " pending order(s).");
    }
    for (var i = 0; i < orders.length; i++) {
      try {
        await processOrder(orders[i]);
      } catch (err) {
        console.error(
          "[printer-listener] Failed to print order #" + orders[i].id + ":",
          err && err.message ? err.message : err
        );
      }
    }
  } catch (err) {
    console.error("[printer-listener] Polling error:", err && err.message ? err.message : err);
  } finally {
    busy = false;
  }
}

async function main() {
  await ensurePrintedAtColumn();
  console.log("[printer-listener] Started.");
  console.log("[printer-listener] Printer   : " + PRINTER_NAME);
  console.log("[printer-listener] Poll      : " + POLL_MS + "ms");
  console.log("[printer-listener] LineWidth : " + LINE_WIDTH + " chars");
  await tick();
  setInterval(tick, POLL_MS);
}

main().catch(function (err) {
  console.error("[printer-listener] Fatal:", err);
  process.exit(1);
});
