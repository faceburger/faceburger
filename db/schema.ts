import {
  pgTable,
  serial,
  integer,
  boolean,
  text,
  numeric,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: jsonb("name").$type<{ fr: string; ar: string; en: string }>().notNull(),
  /** Hero image for menu category chips (Cloudinary or HTTPS URL). */
  imageUrl: text("image_url").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: jsonb("name").$type<{ fr: string; ar: string; en: string }>().notNull(),
  description: jsonb("description")
    .$type<{ fr: string; ar: string; en: string }>()
    .notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url").notNull().default(""),
  available: boolean("available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const optionGroups = pgTable("option_groups", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  name: jsonb("name").$type<{ fr: string; ar: string; en: string }>().notNull(),
  required: boolean("required").notNull().default(false),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
  freeSelections: integer("free_selections").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  visibilityCondition: jsonb("visibility_condition").$type<{ groupFr: string; optionFr: string } | null>().default(null),
});

export const options = pgTable("options", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .notNull()
    .references(() => optionGroups.id, { onDelete: "cascade" }),
  name: jsonb("name").$type<{ fr: string; ar: string; en: string }>().notNull(),
  extraPrice: numeric("extra_price", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  items: jsonb("items").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  /** Extended checkout fields (service mode, payment, map, etc.) */
  orderMeta: jsonb("order_meta").$type<Record<string, unknown> | null>(),
  /** Filled after both kitchen + receipt tickets are printed successfully. */
  printedAt: timestamp("printed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const restaurantSettings = pgTable("restaurant_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

/** Reusable addon group templates (e.g. "Frites", "Boisson") */
export const addonTemplates = pgTable("addon_templates", {
  id: serial("id").primaryKey(),
  name: jsonb("name").$type<{ fr: string; ar: string; en: string }>().notNull(),
  required: boolean("required").notNull().default(false),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
  freeSelections: integer("free_selections").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  visibilityCondition: jsonb("visibility_condition").$type<{ groupFr: string; optionFr: string } | null>().default(null),
});

/** Options belonging to an addon template */
export const addonTemplateOptions = pgTable("addon_template_options", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => addonTemplates.id, { onDelete: "cascade" }),
  name: jsonb("name").$type<{ fr: string; ar: string; en: string }>().notNull(),
  extraPrice: numeric("extra_price", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
});
