require("dotenv").config();

var fs = require("fs").promises;
var os = require("os");
var path = require("path");
var spawn = require("child_process").spawn;
var Pool = require("pg").Pool;

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

// ─── ESC/POS Commands ─────────────────────────────────────────────────────────

var ESC = 0x1B;
var GS = 0x1D;

function buildEscPosKitchen(order) {
  var orderMeta = order.order_meta || {};
  var mode = normalizeServiceMode(orderMeta.serviceMode);
  var items = parseItems(order.items);
  
  var bytes = [];

  // Helper to add bytes
  function push() {
    for (var i = 0; i < arguments.length; i++) {
      bytes.push(arguments[i]);
    }
  }

  // Helper to add text (latin1 encoding for French chars)
  function text(str) {
    var buf = Buffer.from(String(str || ""), "latin1");
    for (var i = 0; i < buf.length; i++) {
      bytes.push(buf[i]);
    }
  }

  // Helper to add text + newline
  function line(str) {
    text(str);
    push(0x0A);
  }

  // Initialize printer
  push(ESC, 0x40);
  
  // Set code page PC850 (French characters)
  push(ESC, 0x74, 0x02);

  // Header - centered, double size, bold
  push(ESC, 0x61, 0x01); // center align
  push(ESC, 0x21, 0x38); // bold + double height + double width
  line("CUISINE");
  push(ESC, 0x21, 0x00); // normal
  line(repeat("-", LINE_WIDTH));
  
  // Order type - centered, bold, bigger (same as receipt)
  push(ESC, 0x21, 0x18); // bold + double height
  line(mode);
  push(ESC, 0x21, 0x00); // normal
  line(repeat("-", LINE_WIDTH));

  // Order info - left aligned
  push(ESC, 0x61, 0x00); // left align
  push(ESC, 0x21, 0x08); // bold
  line("Commande : #" + order.id);
  push(ESC, 0x21, 0x00); // normal
  line("Date     : " + formatDate(order.created_at))
  
  line(repeat("-", LINE_WIDTH));

  // Items - only name and quantity
  items.forEach(function (item) {
    push(ESC, 0x21, 0x08); // bold
    line(item.quantity + " x " + item.name);
    push(ESC, 0x21, 0x00); // normal
    
    // Show options
    item.options.forEach(function (opt) {
      opt = opt || {};
      line("  + " + String(safeGet(opt, "name", "")));
    });
    
    push(0x0A); // blank line between items
  });

  line(repeat("-", LINE_WIDTH));

  // Feed 4 lines and partial cut
  push(ESC, 0x64, 0x04); // feed 4 lines
  push(GS, 0x56, 0x01);  // partial cut

  return Buffer.from(bytes);
}

function buildEscPosReceipt(order) {
  var orderMeta = order.order_meta || {};
  var mode = normalizeServiceMode(orderMeta.serviceMode);
  var items = parseItems(order.items);
  var subtotal = Number(safeGet(orderMeta, "subtotal", 0));
  var deliveryFee = Number(safeGet(orderMeta, "deliveryFee", 0));
  var total = Number(order.total || 0);
  
  var bytes = [];

  // Helper to add bytes
  function push() {
    for (var i = 0; i < arguments.length; i++) {
      bytes.push(arguments[i]);
    }
  }

  // Helper to add text (latin1 encoding for French chars)
  function text(str) {
    var buf = Buffer.from(String(str || ""), "latin1");
    for (var i = 0; i < buf.length; i++) {
      bytes.push(buf[i]);
    }
  }

  // Helper to add text + newline
  function line(str) {
    text(str);
    push(0x0A);
  }

  // Initialize printer
  push(ESC, 0x40);
  
  // Set code page PC850 (French characters)
  push(ESC, 0x74, 0x02);

  // Header - centered, double size, bold
  push(ESC, 0x61, 0x01); // center align
  push(ESC, 0x21, 0x38); // bold + double height + double width
  line("FACEBURGER");
  push(ESC, 0x21, 0x00); // normal
  line("RECU CLIENT");
  line(repeat("-", LINE_WIDTH));
  
  // Order type - centered, bold, bigger
  push(ESC, 0x21, 0x18); // bold + double height
  line(mode);
  push(ESC, 0x21, 0x00); // normal
  line(repeat("-", LINE_WIDTH));

  // Order info - left aligned
  push(ESC, 0x61, 0x00); // left align
  line("Commande : #" + order.id);
  line("Date     : " + formatDate(order.created_at));
  line("Client   : " + order.customer_name);
  line("Tel      : " + order.customer_phone);
  
  if (orderMeta.serviceMode === "delivery") {
    line("Adresse  : " + order.customer_address);
  }

  line(repeat("-", LINE_WIDTH));

  // Items
  items.forEach(function (item) {
    push(ESC, 0x21, 0x08); // bold
    line(item.quantity + " x " + item.name);
    push(ESC, 0x21, 0x00); // normal
    
    item.options.forEach(function (opt) {
      opt = opt || {};
      var extra = Number(safeGet(opt, "extraPrice", 0));
      var extraText = extra > 0 ? " (+" + money(extra) + " MAD)" : "";
      line("  + " + String(safeGet(opt, "name", "")) + extraText);
    });
    
    // Price right-aligned
    var priceStr = money(item.lineTotal) + " MAD";
    push(ESC, 0x61, 0x02); // right align
    line(priceStr);
    push(ESC, 0x61, 0x00); // left align
    push(0x0A); // blank line
  });

  // Totals
  line(repeat("-", LINE_WIDTH));
  line(rightAlign("Sous-total :", money(subtotal) + " MAD"));
  
  if (deliveryFee > 0) {
    line(rightAlign("Livraison  :", money(deliveryFee) + " MAD"));
  }
  
  push(ESC, 0x21, 0x08); // bold
  line(rightAlign("TOTAL      :", money(total) + " MAD"));
  push(ESC, 0x21, 0x00); // normal
  line(repeat("-", LINE_WIDTH));

  // Footer - centered
  push(ESC, 0x61, 0x01); // center align
  line("Merci et a bientot !");

  // Feed 4 lines and partial cut
  push(ESC, 0x64, 0x04); // feed 4 lines
  push(GS, 0x56, 0x01);  // partial cut

  return Buffer.from(bytes);
}

// ─── Raw Printing via batch helper ────────────────────────────────────────────

async function printRawBytes(buffer, label) {
  // Write buffer to temp file
  var tempFile = path.join(os.tmpdir(), "faceburger-" + label + "-" + Date.now() + ".prn");
  await fs.writeFile(tempFile, buffer);

  // Use the batch helper script
  var batchPath = path.join(__dirname, "print-raw.bat");
  
  return new Promise(function (resolve, reject) {
    var child = spawn(batchPath, [PRINTER_NAME, tempFile], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    var output = "";
    child.stdout.on("data", function (c) { output += c.toString(); });
    child.stderr.on("data", function (c) { output += c.toString(); });

    child.on("close", function (code) {
      // Clean up temp file after a short delay
      setTimeout(function () {
        fs.unlink(tempFile).catch(function () {});
      }, 500);
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error("Failed to print raw bytes. Output: " + output.trim()));
      }
    });

    child.on("error", reject);
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

  // Print kitchen ticket first
  var kitchenBuffer = buildEscPosKitchen(order);
  await printRawBytes(kitchenBuffer, "kitchen-" + order.id);
  
  // Wait a bit between prints
  await wait(500);
  
  // Print customer receipt
  var receiptBuffer = buildEscPosReceipt(order);
  await printRawBytes(receiptBuffer, "receipt-" + order.id);

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
