# إعداد Meilisearch محليًا

> Meilisearch هو فهرس البحث فقط — PostgreSQL يبقى مصدر الحقيقة.
> بدون `MEILISEARCH_MASTER_KEY` يعمل الموقع طبيعيًا عبر Prisma fallback.

## Docker:

```bash
docker run -it --rm \
  -p 7700:7700 \
  -v $(pwd)/meili_data:/meili_data \
  getmeili/meilisearch:v1.12 \
  meilisearch --master-key="your-master-key"
```

## أو عبر docker-compose (أضف إلى ملف موجود إن وجد):

```yaml
meilisearch:
  image: getmeili/meilisearch:v1.12
  ports: ["7700:7700"]
  environment:
    MEILI_MASTER_KEY: "your-master-key"
  volumes:
    - ./meili_data:/meili_data
```

## بعد التشغيل:

```bash
# 1) إعداد الفهارس (mods/games/teams/users)
bun run meili:setup

# 2) ملء الفهارس من Prisma (التعريبات المنشورة فقط)
bun run meili:seed
```

## متغيرات البيئة (`.env.local`):

```bash
MEILISEARCH_HOST="http://localhost:7700"
MEILISEARCH_MASTER_KEY="your-master-key"
```

اترك `MEILISEARCH_MASTER_KEY` فارغًا لتعطيل Meilisearch والاعتماد على Prisma.
