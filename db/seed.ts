import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  categories, items, optionGroups, options,
  addonTemplates, addonTemplateOptions,
} from "./schema";

type DB = ReturnType<typeof drizzle>;

const n = (fr: string, ar = fr, en = fr) => ({ fr, ar, en });
const d = (fr: string) => ({ fr, ar: "", en: "" });

// Apply a generic template (Boisson, Sauce…) to item IDs
async function applyTemplate(
  db: DB,
  tmplName: { fr: string; ar: string; en: string },
  tmplOpts: { name: { fr: string; ar: string; en: string }; extraPrice: string }[],
  required: boolean, minSelect: number, maxSelect: number,
  itemIds: number[],
) {
  for (const itemId of itemIds) {
    const [group] = await db.insert(optionGroups)
      .values({ itemId, name: tmplName, required, minSelect, maxSelect })
      .returning();
    if (tmplOpts.length > 0) {
      await db.insert(options).values(
        tmplOpts.map(o => ({ groupId: group!.id, name: o.name, extraPrice: o.extraPrice })),
      );
    }
  }
}

// Add Format group with the real menu surcharge per item
async function addFormatGroup(db: DB, itemId: number, menuSurcharge: number) {
  const [group] = await db.insert(optionGroups).values({
    itemId,
    name: n("Format", "الصيغة", "Format"),
    required: true, minSelect: 1, maxSelect: 1,
  }).returning();
  await db.insert(options).values([
    { groupId: group!.id, name: n("Solo", "سولو", "Solo"), extraPrice: "0" },
    {
      groupId: group!.id,
      name: n(
        "Menu — Frites + Boisson",
        "منو — بطاطا + مشروب",
        "Menu — Fries + Drink",
      ),
      extraPrice: String(menuSurcharge),
    },
  ]);
}

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));

  console.log("🧹 Clearing existing data...");
  await db.delete(categories);
  await db.delete(addonTemplates);

  console.log("🌱 Seeding FaceBurger menu...");

  // ── Categories ────────────────────────────────────────────────────────────
  const [catBurgers, catSandwiches, catTacos, catSides, catKids] = await db
    .insert(categories).values([
      { name: n("Burgers",            "برغر",          "Burgers"),            imageUrl: "", sortOrder: 1 },
      { name: n("Sandwiches & Wraps", "ساندويتش وراب", "Sandwiches & Wraps"), imageUrl: "", sortOrder: 2 },
      { name: n("Tacos",              "تاكوس",          "Tacos"),              imageUrl: "", sortOrder: 3 },
      { name: n("Frites & Sides",     "بطاطا وإضافات",  "Fries & Sides"),      imageUrl: "", sortOrder: 4 },
      { name: n("Menu Enfant",        "وجبة أطفال",     "Kids Meal"),          imageUrl: "", sortOrder: 5 },
    ]).returning();

  console.log("✅ Categories");

  // ── Reusable templates (visible in Admin → Options) ───────────────────────

  // Format template (reference for admin — prices must be adjusted per item after applying)
  const [tmplFormat] = await db.insert(addonTemplates)
    .values({ name: n("Format", "الصيغة", "Format"), required: true, minSelect: 1, maxSelect: 1 })
    .returning();
  await db.insert(addonTemplateOptions).values([
    { templateId: tmplFormat!.id, name: n("Solo", "سولو", "Solo"), extraPrice: "0" },
    { templateId: tmplFormat!.id, name: n("Menu — Frites + Boisson", "منو — بطاطا + مشروب", "Menu — Fries + Drink"), extraPrice: "10"  },
  ]);

  // Boisson template
  const boissonName = n("Boisson (si Menu)", "المشروب (إن اخترت منو)", "Drink (if Menu)");
  const boissonOpts = [
    { name: n("Coca",         "كوكا",         "Coca"),         extraPrice: "0" },
    { name: n("Coca 0",       "كوكا زيرو",    "Coca Zero"),    extraPrice: "0" },
    { name: n("Hawaï",        "هاواي",        "Hawaï"),        extraPrice: "0" },
    { name: n("Fanta Orange", "فانتا برتقال", "Fanta Orange"), extraPrice: "0" },
    { name: n("Fanta Citron", "فانتا ليمون",  "Fanta Citron"), extraPrice: "0" },
    { name: n("Poms",         "بومز",         "Poms"),         extraPrice: "0" },
    { name: n("Sprite",       "سبرايت",       "Sprite"),       extraPrice: "0" },
    { name: n("Palpi Pêche",  "بالبي خوخ",   "Palpi Peach"),  extraPrice: "0" },
    { name: n("Palpi Orange", "بالبي برتقال", "Palpi Orange"), extraPrice: "0" },
  ];
  const [tmplBoisson] = await db.insert(addonTemplates)
    .values({ name: boissonName, required: false, minSelect: 0, maxSelect: 1 })
    .returning();
  await db.insert(addonTemplateOptions).values(
    boissonOpts.map(o => ({ templateId: tmplBoisson!.id, name: o.name, extraPrice: o.extraPrice })),
  );

  // Sauce Tacos template
  const sauceName = n("Sauce Tacos", "صوص التاكوس", "Tacos Sauce");
  const sauceOpts = [
    { name: n("Sauce blanche",    "صوص أبيض",    "White Sauce"),     extraPrice: "0" },
    { name: n("Sauce andalouse",  "صوص أندلوسي", "Andalouse Sauce"), extraPrice: "0" },
    { name: n("Sauce algérienne", "صوص جزائري",  "Algerian Sauce"),  extraPrice: "0" },
    { name: n("Sauce harissa",    "صوص حريصة",   "Harissa Sauce"),   extraPrice: "0" },
    { name: n("Barbecue",         "باربيكيو",     "Barbecue"),        extraPrice: "0" },
    { name: n("Ketchup",          "كاتشاب",       "Ketchup"),         extraPrice: "0" },
    { name: n("Mayonnaise",       "مايونيز",      "Mayonnaise"),      extraPrice: "0" },
  ];
  const [tmplSauce] = await db.insert(addonTemplates)
    .values({ name: sauceName, required: false, minSelect: 0, maxSelect: 1 })
    .returning();
  await db.insert(addonTemplateOptions).values(
    sauceOpts.map(o => ({ templateId: tmplSauce!.id, name: o.name, extraPrice: o.extraPrice })),
  );

  console.log("✅ Templates (Format, Boisson, Sauce Tacos)");

  // ── Burgers ───────────────────────────────────────────────────────────────
  // [fr, ar, desc, solo price, menu surcharge]
  const burgerDefs: [string, string, string, number, number][] = [
    ["Burger",               "برغر",           "",                    12, 10],
    ["Cheese Burger",        "تشيز برغر",       "",                    15, 10],
    ["Double Cheese Burger", "دبل تشيز برغر",   "Sauce andalouse + barbecue", 25, 10],
    ["Fish Burger",          "فيش برغر",        "",                    25, 10],
    ["Original",             "أوريجينال",       "",                    32, 13],
    ["Big Up",               "بيغ أب",          "",                    32, 13],
    ["Bacon Cheese",         "بيكون تشيز",      "New",                 29,  7],
    ["Chicken Burger",       "تشيكن برغر",      "",                    26, 13],
    ["Blinday",              "بلينداي",         "",                    40, 13],
    ["Boss Cheddar",         "بوس تشيدار",      "Onion Crunch",        29,  7],
    ["Big Pepper",           "بيغ بيبار",       "Cheddar — New",       29,  7],
    ["Country",              "كونتري",          "Cheddar",             35,  7],
    ["Chicken Beef",         "تشيكن بيف",       "Cheddar",             35,  7],
    ["Giant",                "جاينت",           "",                    35,  7],
    ["Royal",                "رويال",           "",                    35,  7],
    ["Face Burger",          "فايس برغر",       "",                    37, 13],
    ["Fish Extreme",         "فيش إكستريم",     "",                    32, 13],
    ["Chicken Tower",        "تشيكن تاور",      "",                    37, 13],
  ];

  const insertedBurgers = await db.insert(items).values(
    burgerDefs.map(([fr, ar, desc, price], i) => ({
      categoryId: catBurgers!.id,
      name: n(fr, ar, fr), description: d(desc),
      price: String(price), imageUrl: "", available: true, sortOrder: i + 1,
    })),
  ).returning();

  for (let i = 0; i < insertedBurgers.length; i++) {
    await addFormatGroup(db, insertedBurgers[i]!.id, burgerDefs[i]![4]);
  }
  await applyTemplate(db, boissonName, boissonOpts, false, 0, 1, insertedBurgers.map(b => b.id));

  console.log("✅ Burgers");

  // ── Sandwiches & Wraps ────────────────────────────────────────────────────

  // Panini — viande au choix only
  const [panini] = await db.insert(items).values({
    categoryId: catSandwiches!.id,
    name: n("Panini", "باناني", "Panini"),
    description: d("Fromage, tomates, roquette — viande au choix"),
    price: "22", imageUrl: "", available: true, sortOrder: 1,
  }).returning();
  const [paniniGroup] = await db.insert(optionGroups).values({
    itemId: panini!.id, name: n("Viande", "اللحم", "Meat"), required: true, minSelect: 1, maxSelect: 1,
  }).returning();
  await db.insert(options).values([
    { groupId: paniniGroup!.id, name: n("Thon",     "تونة",   "Tuna"),     extraPrice: "0" },
    { groupId: paniniGroup!.id, name: n("Poulet",   "دجاج",   "Chicken"),  extraPrice: "0" },
    { groupId: paniniGroup!.id, name: n("Chawarma", "شاورما", "Shawarma"), extraPrice: "0" },
  ]);

  // Fixed-price sandwiches (no format)
  await db.insert(items).values([
    { categoryId: catSandwiches!.id, name: n("Le Croq",     "لو كروك",  "Le Croq"),     description: d("Jambon, œuf, thon, charcuterie — Frites + Boisson inclus"), price: "28", imageUrl: "", available: true, sortOrder: 2 },
    { categoryId: catSandwiches!.id, name: n("Chicken Roll", "تشيكن رول","Chicken Roll"), description: d("Frites + Boisson inclus"),                                  price: "28", imageUrl: "", available: true, sortOrder: 3 },
    { categoryId: catSandwiches!.id, name: n("Burritos",    "بوريتوس",  "Burritos"),    description: d("Viande de bœuf — Frites offertes"),                         price: "45", imageUrl: "", available: true, sortOrder: 4 },
  ]);

  // Sandwiches with Solo / Menu (+7 each)
  const sandwichDefs: [string, string, string, number][] = [
    ["Triplex",      "تريبلكس",   "",                 40],
    ["Hummer",       "هومر",      "Sauce tartare",    39],
    ["Kebab",        "كباب",      "",                 30],
    ["Duo",          "دو",        "",                 30],
    ["Red Tikka",    "ريد تيكا",  "Sauce algérienne", 29],
    ["Yellow Tikka", "يلو تيكا",  "Sauce curry",      29],
    ["Cordon Bleu",  "كوردون بلو","",                 38],
    ["Beef",         "بيف",       "",                 40],
  ];

  const insertedSandwiches = await db.insert(items).values(
    sandwichDefs.map(([fr, ar, desc, price], i) => ({
      categoryId: catSandwiches!.id,
      name: n(fr, ar, fr), description: d(desc),
      price: String(price), imageUrl: "", available: true, sortOrder: 5 + i,
    })),
  ).returning();

  for (const s of insertedSandwiches) {
    await addFormatGroup(db, s.id, 7);
  }
  await applyTemplate(db, boissonName, boissonOpts, false, 0, 1, insertedSandwiches.map(s => s.id));

  console.log("✅ Sandwiches & Wraps");

  // ── Tacos ─────────────────────────────────────────────────────────────────
  const meats = [
    "Poulet", "Bolognaise", "Tex Mex", "Merguez", "Yellow Tikka",
    "Cordon Bleu", "Red Tikka", "Émincé de bœuf", "Nuggets",
    "Pêcheur", "Tenders", "Kebab", "Mixte",
  ];

  const tacosDefs = [
    { fr: "Tacos M",   ar: "تاكوس M",   desc: "",                                       price: 31, menuSurcharge:  0, boissonFree: false },
    { fr: "Tacos L",   ar: "تاكوس L",   desc: "",                                       price: 38, menuSurcharge: 10, boissonFree: false },
    { fr: "Tacos XL",  ar: "تاكوس XL",  desc: "Double viande — 300g",                   price: 55, menuSurcharge: 10, boissonFree: false },
    { fr: "Tacos XXL", ar: "تاكوس XXL", desc: "Triple viande — 450g — Boisson offerte", price: 65, menuSurcharge:  0, boissonFree: true  },
  ];

  const insertedTacos = await db.insert(items).values(
    tacosDefs.map((t, i) => ({
      categoryId: catTacos!.id,
      name: n(t.fr, t.ar, t.fr), description: d(t.desc),
      price: String(t.price), imageUrl: "", available: true, sortOrder: i + 1,
    })),
  ).returning();

  for (let i = 0; i < insertedTacos.length; i++) {
    const tacoId = insertedTacos[i]!.id;
    const taco = tacosDefs[i]!;

    // Viande (required, per-item)
    const [viandeGroup] = await db.insert(optionGroups).values({
      itemId: tacoId, name: n("Viande", "اللحم", "Meat"), required: true, minSelect: 1, maxSelect: 1,
    }).returning();
    await db.insert(options).values(meats.map(m => ({ groupId: viandeGroup!.id, name: n(m, m, m), extraPrice: "0" })));

    // Format with real surcharge (L and XL only)
    if (taco.menuSurcharge > 0) {
      await addFormatGroup(db, tacoId, taco.menuSurcharge);
    }

    // Boisson
    if (taco.menuSurcharge > 0 || taco.boissonFree) {
      await applyTemplate(db, boissonName, boissonOpts, false, 0, 1, [tacoId]);
    }

    // Sauce Tacos (all sizes)
    await applyTemplate(db, sauceName, sauceOpts, false, 0, 1, [tacoId]);
  }

  console.log("✅ Tacos");

  // ── Frites & Sides ────────────────────────────────────────────────────────
  await db.insert(items).values([
    { categoryId: catSides!.id, name: n("Tenders x3",       "تيندرز x3",     "Tenders x3"),       description: d(""), price: "18", imageUrl: "", available: true, sortOrder: 1 },
    { categoryId: catSides!.id, name: n("Onion Rings x6",   "حلقات بصل x6",  "Onion Rings x6"),   description: d(""), price: "12", imageUrl: "", available: true, sortOrder: 2 },
    { categoryId: catSides!.id, name: n("Chicken Wings x6", "أجنحة دجاج x6", "Chicken Wings x6"), description: d(""), price: "18", imageUrl: "", available: true, sortOrder: 3 },
    { categoryId: catSides!.id, name: n("Nuggets x8",       "ناغتس x8",      "Nuggets x8"),       description: d(""), price: "18", imageUrl: "", available: true, sortOrder: 4 },
    { categoryId: catSides!.id, name: n("Potatoes",         "بطاطا",          "Potatoes"),         description: d(""), price: "10", imageUrl: "", available: true, sortOrder: 5 },
    { categoryId: catSides!.id, name: n("Röstis",           "روستي",          "Röstis"),           description: d(""),  price: "7", imageUrl: "", available: true, sortOrder: 6 },
  ]);

  console.log("✅ Frites & Sides");

  // ── Menu Enfant ───────────────────────────────────────────────────────────
  const [kidsItem] = await db.insert(items).values({
    categoryId: catKids!.id,
    name: n("Menu Enfant", "وجبة أطفال", "Kids Meal"),
    description: d("Frites + Boisson inclus"),
    price: "25", imageUrl: "", available: true, sortOrder: 1,
  }).returning();
  const [kidsGroup] = await db.insert(optionGroups).values({
    itemId: kidsItem!.id, name: n("Choix du plat", "اختيار الطبق", "Meal Choice"), required: true, minSelect: 1, maxSelect: 1,
  }).returning();
  await db.insert(options).values([
    { groupId: kidsGroup!.id, name: n("Tacos",              "تاكوس",        "Tacos"),          extraPrice: "0" },
    { groupId: kidsGroup!.id, name: n("Nuggets (8 pièces)", "ناغتس (8 قطع)","Nuggets (8 pcs)"), extraPrice: "0" },
    { groupId: kidsGroup!.id, name: n("Burger",             "برغر",         "Burger"),          extraPrice: "0" },
  ]);
  await applyTemplate(db, boissonName, boissonOpts, false, 0, 1, [kidsItem!.id]);

  console.log("✅ Menu Enfant");
  console.log("🎉 Seed complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
