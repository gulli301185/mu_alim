-- Split QA view counters: Telegram baseline + site visits, total in views
ALTER TABLE "qa_articles" ADD COLUMN "telegram_views" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "qa_articles" ADD COLUMN "site_views" INTEGER NOT NULL DEFAULT 0;
UPDATE "qa_articles" SET "site_views" = "views";
