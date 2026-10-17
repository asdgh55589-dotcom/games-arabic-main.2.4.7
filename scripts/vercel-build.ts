import { execSync } from "child_process";

const env = process.env["VERCEL_ENV"] ?? "development";

function run(cmd: string) {
  console.warn(`[vercel-build] Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

// الهجرات على الإنتاج فقط — بيئات المعاينة تشترك في نفس DB
if (env === "production") {
  run("npx prisma migrate deploy");
}
run("npx prisma generate");
run("npx next build");
