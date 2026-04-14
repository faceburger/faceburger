"use server";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

export async function createOrder(input: CreateOrderInput) {
  await db.insert(orders).values({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerAddress: input.customerAddress,
    items: input.items,
    total: input.total.toFixed(2),
    orderMeta: input.orderMeta ?? null,
  });
}

export async function getOrders() {
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function deleteOrder(id: number) {
  await db.delete(orders).where(eq(orders.id, id));
  revalidatePath("/admin/orders");
}
