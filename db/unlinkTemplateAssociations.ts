import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { optionGroups } from "@/db/schema";

async function main() {
  const [groupsBefore] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(optionGroups);

  await db.delete(optionGroups);

  const [groupsAfter] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(optionGroups);

  console.log(
    JSON.stringify(
      {
        groupsBefore: groupsBefore?.count ?? null,
        groupsAfter: groupsAfter?.count ?? null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
