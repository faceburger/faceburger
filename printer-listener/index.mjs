import "dotenv/config";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const PRINTER_NAME = process.env.PRINTER_NAME;
const POLL_MS = Number.parseInt(process.env.POLL_MS ?? "3000", 10);
const TIMEZONE = process.env.TIMEZONE ?? "Africa/Casablanca";

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

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function money(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function normalizeServiceMode(serviceMode) {
  if (serviceMode === "delivery") return "Livraison";
  if (serviceMode === "pickup") return "A emporter";
  if (serviceMode === "dine_in") return "Sur place";
  return "Non defini";
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function divider() {
  return "----------------------------------------";
}

function parseItems(itemsRaw) {
  if (!Array.isArray(itemsRaw)) return [];
  return itemsRaw.map((it) => ({
    name: String(it?.name ?? ""),
    quantity: Number(it?.quantity ?? 0),
    lineTotal: Number(it?.lineTotal ?? 0),
    options: Array.isArray(it?.options) ? it.options : [],
  }));
}

function buildKitchenTicket(order) {
  const mode = normalizeServiceMode(order.order_meta?.serviceMode);
  const items = parseItems(order.items);
  const lines = [
    "KITCHEN TICKET",
    divider(),
    `Commande : #${order.id}`,
    `Heure    : ${formatDate(order.created_at)}`,
    `Service  : ${mode}`,
    `Client   : ${order.customer_name}`,
    `Tel      : ${order.customer_phone}`,
  ];

  if (order.order_meta?.serviceMode === "delivery") {
    lines.push(`Adresse  : ${order.customer_address}`);
  }

  lines.push(divider(), "ARTICLES", divider());

  for (const item of items) {
    lines.push(`${item.quantity} x ${item.name}`);
    for (const opt of item.options) {
      const extra = Number(opt?.extraPrice ?? 0);
      const extraText = extra > 0 ? ` (+${money(extra)} MAD)` : "";
      lines.push(`  + ${String(opt?.name ?? "")}${extraText}`);
    }
    lines.push("");
  }

  lines.push(divider(), "", "", "\f");
  return lines.join("\n");
}

function buildReceiptTicket(order) {
  const mode = normalizeServiceMode(order.order_meta?.serviceMode);
  const items = parseItems(order.items);
  const subtotal = Number(order.order_meta?.subtotal ?? 0);
  const deliveryFee = Number(order.order_meta?.deliveryFee ?? 0);
  const total = Number(order.total ?? 0);

  const lines = [
    "FACEBURGER",
    "RECU CLIENT",
    divider(),
    `Commande : #${order.id}`,
    `Date     : ${formatDate(order.created_at)}`,
    `Client   : ${order.customer_name}`,
    `Tel      : ${order.customer_phone}`,
    `Service  : ${mode}`,
  ];

  if (order.order_meta?.serviceMode === "delivery") {
    lines.push(`Adresse  : ${order.customer_address}`);
  }

  lines.push(divider(), "DETAIL", divider());

  for (const item of items) {
    lines.push(`${item.quantity} x ${item.name}`);
    for (const opt of item.options) {
      const extra = Number(opt?.extraPrice ?? 0);
      const extraText = extra > 0 ? ` (+${money(extra)} MAD)` : "";
      lines.push(`  + ${String(opt?.name ?? "")}${extraText}`);
    }
    lines.push(`  = ${money(item.lineTotal)} MAD`);
    lines.push("");
  }

  lines.push(divider());
  lines.push(`Sous-total : ${money(subtotal)} MAD`);
  if (deliveryFee > 0) lines.push(`Livraison  : ${money(deliveryFee)} MAD`);
  lines.push(`TOTAL      : ${money(total)} MAD`);
  lines.push(divider(), "Merci et a bientot !", "", "", "\f");

  return lines.join("\n");
}

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `PowerShell exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function sendToPrinter(content, label) {
  const filename = `faceburger-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`;
  const filePath = path.join(os.tmpdir(), filename);
  await fs.writeFile(filePath, content, "utf8");

  const escapedPath = filePath.replace(/'/g, "''");
  const escapedPrinter = PRINTER_NAME.replace(/'/g, "''");
  const command = `Get-Content -Raw -Path '${escapedPath}' | Out-Printer -Name '${escapedPrinter}'`;

  try {
    await runPowerShell(command);
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

async function ensurePrintedAtColumn() {
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS printed_at timestamp null
  `);
}

async function fetchPendingOrders() {
  const result = await pool.query(
    `
      SELECT id, customer_name, customer_phone, customer_address, items, total, order_meta, created_at
      FROM orders
      WHERE printed_at IS NULL
      ORDER BY created_at ASC
      LIMIT 20
    `
  );
  return result.rows;
}

async function markPrinted(orderId) {
  await pool.query(
    `
      UPDATE orders
      SET printed_at = NOW()
      WHERE id = $1
    `,
    [orderId]
  );
}

async function processOrder(order) {
  console.log(`[printer-listener] Printing order #${order.id}...`);
  const kitchen = buildKitchenTicket(order);
  const receipt = buildReceiptTicket(order);

  // 2 separate print jobs on the same printer.
  await sendToPrinter(kitchen, `kitchen-${order.id}`);
  await new Promise((r) => setTimeout(r, 350));
  await sendToPrinter(receipt, `receipt-${order.id}`);

  await markPrinted(order.id);
  console.log(`[printer-listener] Printed order #${order.id} successfully.`);
}

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;

  try {
    const orders = await fetchPendingOrders();
    if (orders.length > 0) {
      console.log(`[printer-listener] Found ${orders.length} pending order(s).`);
    }
    for (const order of orders) {
      try {
        await processOrder(order);
      } catch (error) {
        console.error(
          `[printer-listener] Failed to print order #${order.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  } catch (error) {
    console.error(
      "[printer-listener] Polling error:",
      error instanceof Error ? error.message : error
    );
  } finally {
    busy = false;
  }
}

async function main() {
  await ensurePrintedAtColumn();
  console.log("[printer-listener] Started.");
  console.log(`[printer-listener] Printer: ${PRINTER_NAME}`);
  console.log(`[printer-listener] Poll interval: ${POLL_MS}ms`);

  await tick();
  setInterval(tick, POLL_MS);
}

main().catch((error) => {
  console.error("[printer-listener] Fatal error:", error);
  process.exit(1);
});
