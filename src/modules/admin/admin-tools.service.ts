import { Injectable, Logger } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class AdminToolsService {
  private readonly logger = new Logger(AdminToolsService.name);
  constructor(private readonly prisma: PrismaUserService) {}

  /**
   * Identifies users who have emails but none marked as primary,
   * and sets their oldest email as primary.
   */
  async fixMissingPrimaryEmails() {
    this.logger.log("Starting retroactive primary email fix using raw SQL...");

    const sql = `
      UPDATE user_emails
      SET is_primary = true
      WHERE id IN (
          SELECT id
          FROM (
              SELECT ue.id, ROW_NUMBER() OVER (PARTITION BY ue.user_id ORDER BY ue.created_at ASC) as rn
              FROM user_emails ue
              JOIN users u ON ue.user_id = u.id
              WHERE u.id NOT IN (
                  SELECT user_id FROM user_emails WHERE is_primary = true
              )
          ) t
          WHERE rn = 1
      );
    `;

    const result = await this.prisma.$executeRawUnsafe(sql);

    this.logger.log(`Successfully fixed ${result} users using raw SQL.`);
    return {
      fixed: result,
      method: "raw_sql",
    };
  }
}
