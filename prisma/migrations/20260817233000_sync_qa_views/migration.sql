-- Keep total views in sync with telegram + site counters
UPDATE "qa_articles" SET "views" = "telegram_views" + "site_views";
