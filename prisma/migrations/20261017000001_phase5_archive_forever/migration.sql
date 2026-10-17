-- Phase 5 — الأرشفة والقوالب الأبدية (additive فقط)
-- 1) SocialPost: archivedAt (أرشفة ناعمة) + siteMode (مرآة وضعية النشر)
-- 2) SocialPostTemplate: isArchived/archivedAt (لا حذف فيزيائي أبداً)
-- 3) SocialPostTemplateVersion: لقطات غير قابلة للتعديل (تراجع = نسخة جديدة)

ALTER TABLE "social_posts"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "site_mode" TEXT;

CREATE INDEX "social_posts_archived_at_idx" ON "social_posts"("archived_at");

ALTER TABLE "social_post_templates"
  ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "social_post_templates_is_archived_idx" ON "social_post_templates"("is_archived");

-- CreateTable
CREATE TABLE "social_post_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "parse_mode" TEXT,
    "rich_document" JSONB,
    "media_url" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "changed_by" TEXT,
    "change_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_post_template_versions_template_id_idx" ON "social_post_template_versions"("template_id");

-- AddForeignKey
ALTER TABLE "social_post_template_versions" ADD CONSTRAINT "social_post_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "social_post_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
