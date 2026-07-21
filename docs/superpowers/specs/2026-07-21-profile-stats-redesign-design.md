# Profile Stats Redesign + Translator Mode

**Date**: 2026-07-21
**Status**: Approved by user

## Overview

Redesign the profile stats section to use horizontal compact cards (matching the provided reference screenshot), and introduce two user modes: regular user and translator (المعرب). Translators see additional stats (XP, level, badges, first mod date, rating) activated from profile settings.

## Current State

- `profile-stats.tsx` renders 8 square cards in a 4-column grid (icon on top, label, value)
- No distinction between regular users and translators
- XP percentage shown for all users regardless of role

## Design

### 1. Stat Card Style

**Current layout** (square cards):
```
┌──────────┐ ┌──────────┐
│   📦     │ │   ⬇️     │
│ التعريبات│ │ التحميلات│
│    31    │ │   113K   │
└──────────┘ └──────────┘
```

**New layout** (horizontal compact cards matching reference):
```
┌─────────────────────────────────────────────┐
│  📦  عدد التعريبات                         31  │
├─────────────────────────────────────────────┤
│  ⬇️  إجمالي التحميلات                  113K  │
├─────────────────────────────────────────────┤
│  👍  التأييدات                          15.8K  │
└─────────────────────────────────────────────┘
```

Card structure:
- Full width, compact height (~48px)
- Horizontal layout: `[icon] [label] ... [value]`
- Icon on the right (RTL), label in middle, value on the left
- Subtle bottom border between cards (not full card backgrounds)
- Background: transparent or very subtle `#1a1a1a`

### 2. User Modes

#### Regular User
Shows 6 stat cards:
1. عدد التعريبات (mods count)
2. إجمالي التحميلات (total downloads)
3. التأييدات (endorsements)
4. المشاهدات (views)
5. المتابعين (followers)
6. المتابَعين (following)

#### Translator (المعرب)
Shows all 6 regular stats PLUS translator-specific stats:

**Translator Stats** (displayed after a divider):
7. نسبة الإنجاز (XP progress bar with percentage)
8. المستوى (level name, e.g. "خبير")
9. الشارات المكتسبة (earned badges count)
10. تاريخ أول تعريب (first mod date)
11. التقييم (rating/quality score)

XP progress percentage only visible for translators, NOT regular users.

### 3. Upgrade to Translator Flow

**Location**: Settings tab in profile page

**Button**: "ترقية إلى معرب" (Upgrade to Translator)

**Requirements Page**: A modal or separate view showing:
- Requirements checklist (e.g. minimum mods published, account age, etc.)
- Apply button to submit upgrade request

The requirements page is triggered from the Settings tab button. The exact requirements are configurable via the API.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/profile/profile-stats.tsx` | Redesign to horizontal compact cards, add translator mode prop |
| `src/views/profile.tsx` | Add `isTranslator` prop, pass to stats component, add upgrade button in settings |
| `src/components/profile/profile-settings.tsx` | Add "ترقية إلى معرب" button |
| `src/app/api/users/[username]/profile/route.ts` | Add translator-specific fields to response (firstModDate, rating, badges count) |

## Data Model

No schema changes needed. The translator role is determined by `user.role` (already exists). The additional translator stats are computed from existing data:
- `firstModDate`: `MIN(mod.createdAt)` for mods by this user
- `rating`: `user.qualityScore` (already exists)
- `badges count`: from the badges API

## API Changes

### GET /api/users/[username]/profile
Add to response:
```json
{
  "profile": {
    "isTranslator": true,
    "firstModDate": "2024-01-15T...",
    "rating": 85
  }
}
```

These fields are only populated when the user is a translator/moderator/admin.
