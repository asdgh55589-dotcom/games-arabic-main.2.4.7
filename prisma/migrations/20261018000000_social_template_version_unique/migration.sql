-- CreateIndex
CREATE UNIQUE INDEX "social_post_template_versions_template_id_version_key"
  ON "social_post_template_versions"("template_id", "version");
