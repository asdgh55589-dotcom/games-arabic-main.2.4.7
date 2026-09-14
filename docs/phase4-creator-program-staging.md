# Phase 4 — Content Creator Program: Staging Checklist (docs only)

Branch: `feat/creator-program-expansion` (Tasks 1–7 committed, suite 892/892, tsc clean).
Nothing below has been executed — staging verification steps for a human.

## 0. Env

- [ ] Set `EMITLO_API_KEY` + `EMAIL_FROM` (approval emails are fail-open without them:
 .warn + skip; see `sendCreatorApprovalEmail` in `src/lib/notifications/email-service.ts`)
- [ ] Apply migrations on staging via the normal deploy path
  (`20260907070000_add_creator_track_and_portfolio`,
  `20260907080000_add_creator_approve_note` — both additive-only)

## 1. Publisher end-to-end

- [ ] New member applies via `/become-creator/apply` → track **ناشر** → 3–5 portfolio URLs →
  years → samples → socials → motivation (100–1000) → terms → submit 201
- [ ] Admin sees the request at `/admin/creators/requests` (track badge ناشر,
  clickable portfolio, years/samples, socials, internal notes)
- [ ] Admin approves with an approve note → user role becomes **publisher**
- [ ] Applicant gets in-app notification + email (track + next steps + note)
- [ ] Publisher opens `/creator/news` and publishes a post (201)

## 2. Translator end-to-end

- [ ] New member applies → track **معرّب** → same wizard → submit 201
- [ ] Admin approves → user role becomes **creator**
- [ ] Translator opens `/creator/news` → redirected to `/creator`
  (sidebar has no news item for translators)
- [ ] Translator `POST /api/creator/news` → **403** (`news.create` is publisher-only)
- [ ] Translator can still create own-translation mods (`mod.translate`)

## 3. Applicant status page

- [ ] Pending applicant sees `/become-creator/status`:
  `تحت المراجعة — سنرد خلال 48 ساعة` + track + submission date
- [ ] Pending > 48h shows the escalation box linking to `/support`
- [ ] Approved sees welcome + reviewer note + `/creator` link
- [ ] Rejected sees reason + resubmit link back to `/become-creator/apply`

## 4. Emitlo staging checklist

- [ ] `EMITLO_API_KEY` set on staging (approval emails are fail-open without it)
- [ ] Sending domain DNS verified (SPF/DKIM) in Emitlo dashboard
- [ ] Test email arrives (template render + delivery)
- [ ] Creator approval email arrives (applicant inbox)
- [ ] Password-reset email arrives
