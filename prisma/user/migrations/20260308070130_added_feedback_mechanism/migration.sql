-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('GENERAL', 'INLINE', 'PAYWALL', 'FEATURE_REQUEST');

-- CreateEnum
CREATE TYPE "FeedbackSentiment" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateTable
CREATE TABLE "user_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" "FeedbackType" NOT NULL,
    "sentiment" "FeedbackSentiment",
    "category" TEXT,
    "message" TEXT,
    "email" TEXT,
    "page_url" TEXT,
    "section_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_feedback_user_id_idx" ON "user_feedback"("user_id");

-- CreateIndex
CREATE INDEX "user_feedback_type_idx" ON "user_feedback"("type");

-- CreateIndex
CREATE INDEX "user_feedback_created_at_idx" ON "user_feedback"("created_at");

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
