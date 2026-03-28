/**
 * One-time cleanup script to remove duplicate emails across users.
 * Run this BEFORE applying the global email uniqueness migration.
 *
 * Usage: npx ts-node scripts/cleanup-duplicate-emails.ts
 */

import { PrismaClient } from "../node_modules/.prisma/user-client";

const prisma = new PrismaClient();

async function main() {
  console.log("Finding duplicate emails across user accounts...\n");

  // Find emails that appear more than once
  const duplicates = await prisma.$queryRaw<
    Array<{ email: string; count: bigint }>
  >`
    SELECT email, COUNT(*) as count
    FROM user_emails
    GROUP BY email
    HAVING COUNT(*) > 1
  `;

  if (duplicates.length === 0) {
    console.log("No duplicate emails found. Safe to run migration.");
    return;
  }

  console.log(`Found ${duplicates.length} duplicate email(s):\n`);

  for (const dup of duplicates) {
    const entries = await prisma.user_emails.findMany({
      where: { email: dup.email },
      include: { user: { select: { wallet_address: true } } },
      orderBy: { created_at: "asc" },
    });

    console.log(`  Email: ${dup.email} (${entries.length} entries)`);

    // Keep the first verified entry, or the oldest entry if none are verified
    const verified = entries.find((e) => e.is_verified);
    const keeper = verified || entries[0];
    const toDelete = entries.filter((e) => e.id !== keeper.id);

    console.log(
      `    Keeping: user=${keeper.user_id} (wallet=${keeper.user.wallet_address}, verified=${keeper.is_verified}, primary=${keeper.is_primary})`,
    );

    for (const entry of toDelete) {
      console.log(
        `    Deleting: user=${entry.user_id} (wallet=${entry.user.wallet_address}, verified=${entry.is_verified}, primary=${entry.is_primary})`,
      );
      await prisma.user_emails.delete({ where: { id: entry.id } });
    }

    console.log();
  }

  console.log("Cleanup complete. You can now run the migration.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
