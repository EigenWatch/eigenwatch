-- CreateTable
CREATE TABLE "beta_members" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "beta_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_perks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_perks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_beta_perks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "perk_id" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notification_seen" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "user_beta_perks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beta_members_email_key" ON "beta_members"("email");

-- CreateIndex
CREATE INDEX "beta_members_email_idx" ON "beta_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "beta_perks_key_key" ON "beta_perks"("key");

-- CreateIndex
CREATE INDEX "user_beta_perks_user_id_idx" ON "user_beta_perks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_beta_perks_user_id_perk_id_key" ON "user_beta_perks"("user_id", "perk_id");

-- AddForeignKey
ALTER TABLE "user_beta_perks" ADD CONSTRAINT "user_beta_perks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_beta_perks" ADD CONSTRAINT "user_beta_perks_perk_id_fkey" FOREIGN KEY ("perk_id") REFERENCES "beta_perks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
