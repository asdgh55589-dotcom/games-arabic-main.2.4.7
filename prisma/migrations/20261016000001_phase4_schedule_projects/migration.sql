-- CreateTable
CREATE TABLE "social_schedule_projects" (
    "id" TEXT NOT NULL,
    "mod_id" TEXT,
    "post_id" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'both',
    "site_publish_at" TIMESTAMP(3),
    "social_publish_at" TIMESTAMP(3),
    "target_ids" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_schedule_projects_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Mod" ADD COLUMN     "publish_mode" TEXT NOT NULL DEFAULT 'both',
ADD COLUMN     "social_post_id" TEXT,
ADD COLUMN     "social_scheduled_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "social_schedule_projects_status_idx" ON "social_schedule_projects"("status");
CREATE INDEX "social_schedule_projects_mod_id_idx" ON "social_schedule_projects"("mod_id");
CREATE INDEX "social_schedule_projects_post_id_idx" ON "social_schedule_projects"("post_id");

-- AddForeignKey
ALTER TABLE "social_schedule_projects" ADD CONSTRAINT "social_schedule_projects_mod_id_fkey" FOREIGN KEY ("mod_id") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_schedule_projects" ADD CONSTRAINT "social_schedule_projects_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_social_post_id_fkey" FOREIGN KEY ("social_post_id") REFERENCES "social_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
