-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('pending', 'confirmed', 'unsubscribed');

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "repository_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'pending',
    "confirm_token" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unsub_token" UUID NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_confirm_token_key" ON "subscriptions"("confirm_token");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_unsub_token_key" ON "subscriptions"("unsub_token");

-- CreateIndex
CREATE INDEX "idx_subscriptions_confirm_token" ON "subscriptions"("confirm_token");

-- CreateIndex
CREATE INDEX "idx_subscriptions_unsub_token" ON "subscriptions"("unsub_token");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_email_repository_id_key" ON "subscriptions"("email", "repository_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
