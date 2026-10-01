-- AlterTable
ALTER TABLE "notification_intents" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "channel" VARCHAR(16) NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "delivery_state" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "last_error" VARCHAR(100);
