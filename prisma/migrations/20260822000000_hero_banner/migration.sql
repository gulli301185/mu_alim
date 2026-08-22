CREATE TABLE "hero_banners" (
    "id" VARCHAR(32) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" VARCHAR(500) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "sky_image_url" VARCHAR(500) NOT NULL,
    "banner_image_url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hero_banners_pkey" PRIMARY KEY ("id")
);

INSERT INTO "hero_banners" ("id", "title", "subtitle", "name", "sky_image_url", "banner_image_url", "updated_at")
VALUES (
    'default',
    'Бийиктикке умтул!',
    'Билим эркиндикке жол ачат, амал ийгиликке жеткирет.',
    'Мухаммадалим',
    '/sky-hero.jpg',
    '/tunduk-hero.jpg',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
