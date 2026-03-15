-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CRYPTO_DIRECT', 'CHAINRAILS');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMING', 'CONFIRMED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_usd" DECIMAL(65,30) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "provider_ref" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "tier_granted" "UserTier" NOT NULL DEFAULT 'PRO',
    "duration_days" INTEGER NOT NULL DEFAULT 30,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_status_history" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "from_status" "PaymentStatus",
    "to_status" "PaymentStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "payment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_transactions_user_id_idx" ON "payment_transactions"("user_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_created_at_idx" ON "payment_transactions"("created_at");

-- CreateIndex
CREATE INDEX "payment_status_history_transaction_id_idx" ON "payment_status_history"("transaction_id");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_status_history" ADD CONSTRAINT "payment_status_history_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
