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

function padRight(str, width) {
  str = String(str || "");
  if (str.length >= width) return str.slice(0, width);
  return str + repeat(" ", width - str.length);
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

// ─── ESC/POS Builder ──────────────────────────────────────────────────────────
//
// Sends raw ESC/POS bytes directly — no Windows GDI, no margins, no page headers.
// Paper length = exactly the content. Ends with a partial cut.

function EscPos() {
  var bytes = [];

  var self = {
    // Printer init
    init: function () { return self._push(0x1B, 0x40); },

    // Code page PC850 — covers French characters (é, à, ê, ç, etc.)
    codePage: function () { return self._push(0x1B, 0x74, 0x02); },

    // Alignment
    left:   function () { return self._push(0x1B, 0x61, 0x00); },
    center: function () { return self._push(0x1B, 0x61, 0x01); },
    right:  function () { return self._push(0x1B, 0x61, 0x02); },

    // Text style  (ESC ! n  — bits: 0x08=bold, 0x10=dbl-height, 0x20=dbl-width)
    normal:    function () { return self._push(0x1B, 0x21, 0x00); },
    bold:      function () { return self._push(0x1B, 0x21, 0x08); },
    bigBold:   function () { return self._push(0x1B, 0x21, 0x38); }, // bold + dbl-height + dbl-width

    // Print text encoded as latin1 (matches PC850 for French)
    text: function (str) {
      var buf = Buffer.from(String(str || ""), "latin1");
      for (var i = 0; i < buf.length; i++) bytes.push(buf[i]);
      return self;
    },

    // Print a line (text + LF)
    line: function (str) { return self.text(str)._push(0x0A); },

    // Full-width divider
    divider: function () { return self.line(repeat("-", LINE_WIDTH)); },

    // Feed n lines then partial cut — this is what ends each ticket
    feedAndCut: function () {
      self._push(0x1B, 0x64, 5); // feed 5 lines
      self._push(0x1D, 0x56, 0x01); // partial cut
      return self;
    },

    _push: function () {
      for (var i = 0; i < arguments.length; i++) bytes.push(arguments[i]);
      return self;
    },

    toBuffer: function () { return Buffer.from(bytes); },
  };

  return self;
}

// ─── Ticket Builders ──────────────────────────────────────────────────────────

function buildKitchenTicket(order) {
  var orderMeta = order.order_meta || {};
  var mode = normalizeServiceMode(orderMeta.serviceMode);
  var items = parseItems(order.items);
  var p = EscPos();

  p.init().codePage();

  // Header
  p.center().bigBold().line("KITCHEN TICKET").normal();
  p.center().line("Commande #" + order.id);
  p.divider();
  p.center().bold().line(mode).normal();
  p.divider();

  // Items
  p.left();
  items.forEach(function (item) {
    p.bold().line(item.quantity + " x " + item.name).normal();
    item.options.forEach(function (opt) {
      opt = opt || {};
      var extra = Number(safeGet(opt, "extraPrice", 0));
      var extraText = extra > 0 ? " (+" + money(extra) + " MAD)" : "";
      p.line("  + " + String(safeGet(opt, "name", "")) + extraText);
    });
  });

  // Footer
  p.divider();
  p.line("Client : " + order.customer_name);
  p.line("Tel    : " + order.customer_phone);
  p.line(formatDate(order.created_at));

  p.feedAndCut();

  return p.toBuffer();
}

function buildReceiptTicket(order) {
  var orderMeta = order.order_meta || {};
  var mode = normalizeServiceMode(orderMeta.serviceMode);
  var items = parseItems(order.items);
  var subtotal = Number(safeGet(orderMeta, "subtotal", 0));
  var deliveryFee = Number(safeGet(orderMeta, "deliveryFee", 0));
  var total = Number(order.total || 0);
  var p = EscPos();

  p.init().codePage();

  // Header
  p.center().bigBold().line("FACEBURGER").normal();
  p.center().line("RECU CLIENT");
  p.divider();

  // Order info
  p.left();
  p.line("Commande : #" + order.id);
  p.line("Date     : " + formatDate(order.created_at));
  p.line("Client   : " + order.customer_name);
  p.line("Tel      : " + order.customer_phone);
  p.line("Service  : " + mode);
  if (orderMeta.serviceMode === "delivery") {
    p.line("Adresse  : " + order.customer_address);
  }

  p.divider();

  // Items
  items.forEach(function (item) {
    p.bold().line(item.quantity + " x " + item.name).normal();
    item.options.forEach(function (opt) {
      opt = opt || {};
      var extra = Number(safeGet(opt, "extraPrice", 0));
      var extraText = extra > 0 ? " (+" + money(extra) + " MAD)" : "";
      p.line("  + " + String(safeGet(opt, "name", "")) + extraText);
    });
    // Price right-aligned on its own line
    var priceStr = money(item.lineTotal) + " MAD";
    p.right().line(priceStr).left();
    p._push(0x0A); // blank line between items
  });

  // Totals
  p.divider();
  p.line(rightAlign("Sous-total :", money(subtotal) + " MAD"));
  if (deliveryFee > 0) {
    p.line(rightAlign("Livraison  :", money(deliveryFee) + " MAD"));
  }
  p.bold().line(rightAlign("TOTAL      :", money(total) + " MAD")).normal();
  p.divider();

  // Footer
  p.center().line("Merci et a bientot !").left();

  p.feedAndCut();

  return p.toBuffer();
}

// ─── Raw Printing via Win32 winspool.drv ──────────────────────────────────────
//
// Sends ESC/POS bytes to the printer in RAW mode — bypasses the Windows GDI
// pipeline entirely. No margins, no page headers, no A4 padding.

var PS_RAW_PRINT_TYPE = [
  'Add-Type -Language CSharp -TypeDefinition @"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public class WinRawPrint {',
  '    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]',
  '    public struct DOCINFO {',
  '        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;',
  '        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;',
  '        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;',
  '    }',
  '    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]',
  '    public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);',
  '    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]',
  '    public static extern bool ClosePrinter(IntPtr h);',
  '    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]',
  '    public static extern bool StartDocPrinter(IntPtr h, int level, ref DOCINFO di);',
  '    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]',
  '    public static extern bool EndDocPrinter(IntPtr h);',
  '    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]',
  '    public static extern bool StartPagePrinter(IntPtr h);',
  '    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]',
  '    public static extern bool EndPagePrinter(IntPtr h);',
  '    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]',
  '    public static extern bool WritePrinter(IntPtr h, IntPtr p, int c, out int w);',
  '    public static bool Send(string printerName, byte[] data) {',
  '        IntPtr hPrinter;',
  '        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;',
  '        var di = new DOCINFO { pDocName = "FaceBurger", pDataType = "RAW" };',
  '        if (!StartDocPrinter(hPrinter, 1, ref di)) { ClosePrinter(hPrinter); return false; }',
  '        if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }',
  '        IntPtr ptr = Marshal.AllocCoTaskMem(data.Length);',
  '        Marshal.Copy(data, 0, ptr, data.Length);',
  '        int written = 0;',
  '        bool ok = WritePrinter(hPrinter, ptr, data.Length, out written);',
  '        Marshal.FreeCoTaskMem(ptr);',
  '        EndPagePrinter(hPrinter);',
  '        EndDocPrinter(hPrinter);',
  '        ClosePrinter(hPrinter);',
  '        return ok;',
  '    }',
  '}',
  '"@',
].join("\n");

async function sendRawESCPOS(buffer, label) {
  var base64 = buffer.toString("base64");
  var escapedPrinter = PRINTER_NAME.replace(/'/g, "''");

  var script = [
    PS_RAW_PRINT_TYPE,
    '$data = [System.Convert]::FromBase64String("' + base64 + '")',
    '$ok = [WinRawPrint]::Send(\'' + escapedPrinter + '\', $data)',
    'if (-not $ok) { Write-Error "SendRaw failed for ' + label + '"; exit 1 }',
  ].join("\n");

  var scriptPath = path.join(os.tmpdir(), "faceburger-" + label + "-" + Date.now() + ".ps1");
  await fs.writeFile(scriptPath, script, "utf8");

  return new Promise(function (resolve, reject) {
    var child = spawn("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", scriptPath,
    ], { stdio: ["ignore", "pipe", "pipe"] });

    var out = "";
    child.stdout.on("data", function (c) { out += c.toString(); });
    child.stderr.on("data", function (c) { out += c.toString(); });

    child.on("close", function (code) {
      fs.unlink(scriptPath).catch(function () {});
      if (code === 0) resolve();
      else reject(new Error(out.trim() || "PowerShell exited with code " + code));
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

  var kitchen = buildKitchenTicket(order);
  var receipt = buildReceiptTicket(order);

  await sendRawESCPOS(kitchen, "kitchen-" + order.id);
  await wait(500);
  await sendRawESCPOS(receipt, "receipt-" + order.id);

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
