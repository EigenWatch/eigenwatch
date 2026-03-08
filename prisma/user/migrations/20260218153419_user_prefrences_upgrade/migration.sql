-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "newsletter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "product_updates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "risk_alerts_operator_changes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "risk_alerts_slashing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "risk_alerts_tvs_changes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "watchlist_daily_summary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "watchlist_status_changes" BOOLEAN NOT NULL DEFAULT true;
