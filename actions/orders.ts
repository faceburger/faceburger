"use server";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_ORDERING_WINDOW,
  isWithinOrderingWindow,
  type OrderingWindow,
} from "@/lib/ordering-hours";

type OrderItem = {
  itemId: number;
  name: string;
  quantity: number;
  basePrice: number;
  options: { name: string; extraPrice: number }[];
  lineTotal: number;
};

type CreateOrderInput = {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  total: number;
  orderMeta?: Record<string, unknown> | null;
};

function getServerOrderingWindow(): OrderingWindow {
  return {
    timeZone: process.env.ORDERING_TIMEZONE || DEFAULT_ORDERING_WINDOW.timeZone,
    start: process.env.ORDERING_START || DEFAULT_ORDERING_WINDOW.start,
    end: process.env.ORDERING_END || DEFAULT_ORDERING_WINDOW.end,
  };
}

export async function createOrder(input: CreateOrderInput): Promise<number> {
  const window = getServerOrderingWindow();
  const within = isWithinOrderingWindow(new Date(), window);
  if (!within.ok) {
    throw new Error("ORDERING_CLOSED");
  }

  const result = await db.insert(orders).values({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerAddress: input.customerAddress,
    items: input.items,
    total: input.total.toFixed(2),
    orderMeta: input.orderMeta ?? null,
  }).returning({ id: orders.id });
  return result[0].id;
}

export async function getOrders() {
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function deleteOrder(id: number) {
  await db.delete(orders).where(eq(orders.id, id));
  revalidatePath("/regrubecaf/orders");
}
