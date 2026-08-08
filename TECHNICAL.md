# Games Arabic - Technical Documentation

> **Arabic Game Translation & Archive Platform**
> Comprehensive technical documentation for developers and contributors.

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Authentication System](#6-authentication-system)
7. [UI Components](#7-ui-components)
8. [Admin Panel](#8-admin-panel)
9. [Deployment](#9-deployment)
10. [Development Guide](#10-development-guide)

---

## 1. Project Architecture

### Overview

Games Arabic (ألعاب بالعربي) is a full-stack web application for archiving and distributing Arabic translation patches ("mods") for video games across PC, Nintendo Switch, and PlayStation platforms. It also serves as a community hub for Arabic translation teams.

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Next.js App Router (SPA with ?view= routing)       │   │
│  │  ├── 24 View Components (lazy-loaded)               │   │
│  │  ├── 35 UI Components (shadcn/ui)                   │   │
│  │  └── React Query + Zustand State                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              API Layer (Next.js Route Handlers)              │
│  ├── 20+ API Route Groups                                  │
│  ├── Edge Middleware (Auth, IP Bans, Session Refresh)       │
│  └── Rate Limiting (Upstash Redis)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│  ├── PostgreSQL (Neon Serverless)                           │
│  ├── Prisma ORM (30+ Models)                               │
│  └── Connection Pool (5 connections, 30s timeout)           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Client Request** → Browser sends request to Next.js
2. **Middleware** → Edge runtime handles auth, IP bans, session refresh
3. **Route Handler** → API endpoints process business logic
4. **Prisma Client** → Type-safe database queries
5. **PostgreSQL** → Data persistence on Neon

### View-Based Routing

The app uses a Single Page Application (SPA) pattern with query parameter routing:

```typescript
// src/app/page.tsx
const view = searchParams.get('view') || 'home';
// Dynamically renders view component based on query param
```

**URL Pattern:** `https://example.com/?view=<view-name>&<params>`

**Available Views:**
- `home` - Homepage with hero, platforms, sidebar
- `mod` - Mod detail page
- `search` - Search across mods and games
- `upload` - Mod upload form
- `profile` - User profile
- `login` - Login page (OAuth + Telegram)
- `series` - Game series listing
- `series-detail` - Individual series page
- `teams` - Translation teams listing
- `team-detail` - Individual team page
- `platform` - Platform-specific mod listing
- `support` - Support page
- `explore` - Explore page
- `community` - Community page
- `about` - About page
- `problems` - Known problems page
- `terms` - Terms of service
- `privacy` - Privacy policy
- `notifications` - User notifications
- `settings` - User settings

---

## 2. Tech Stack

### Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | Next.js | 16 | App Router, standalone output |
| **Language** | TypeScript | 5 | Type safety |
| **UI Library** | React | 19 | Component rendering |
| **Styling** | Tailwind CSS | 4 | Utility-first CSS |
| **Components** | shadcn/ui | - | New York style, 40+ primitives |
| **Database** | PostgreSQL | - | Via Neon serverless |
| **ORM** | Prisma | 6 | Type-safe DB access |
| **Auth** | Supabase Auth | - | OAuth flows |
| **State** | Zustand | - | Client-side state |
| **Data Fetching** | React Query | 5 | Server state management |
| **Animation** | Framer Motion | 12 | Smooth animations |
| **Charts** | Recharts | 2 | Data visualization |
| **Email** | Resend | 6 | Transactional emails |
| **Caching** | Upstash Redis | - | Rate limiting, IP bans |
| **Testing** | Jest | 30 | Unit testing |
| **Package Manager** | Bun | - | Fast runtime |

### Key Dependencies

```json
{
  "core": ["next@16", "react@19", "typescript@5"],
  "ui": ["tailwindcss@4", "shadcn/ui", "framer-motion", "lucide-react"],
  "database": ["@prisma/client@6", "postgresql"],
  "auth": ["@supabase/ssr", "@supabase/supabase-js", "jose"],
  "state": ["zustand", "@tanstack/react-query"],
  "forms": ["react-hook-form", "@hookform/resolvers", "zod"],
  "markdown": ["react-markdown", "@mdxeditor/editor"],
  "utils": ["date-fns", "clsx", "tailwind-merge"]
}
```

---

## 3. Directory Structure

### Root Layout

```
games-arabic-main/
├── src/                    # Source code
│   ├── app/                # Next.js App Router
│   ├── views/              # SPA view components
│   ├── components/         # Reusable UI components
│   ├── lib/                # Utilities and helpers
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React contexts
│   └── __tests__/          # Jest tests
├── prisma/                 # Database schema and migrations
├── public/                 # Static assets
├── scripts/                # Build and dev scripts
├── docs/                   # Documentation
└── [config files]          # Various configuration files
```

### Source Code (`src/`)

```
src/
├── app/
│   ├── layout.tsx          # Root layout (RTL, dark mode, Cairo font)
│   ├── page.tsx            # Main SPA: view switching via ?view=<name>
│   ├── globals.css         # Full theme, gradients, animations
│   ├── error.tsx           # Error boundary
│   ├── not-found.tsx       # 404 page
│   ├── loading.tsx         # Loading state
│   ├── admin/              # Admin panel (19 sections)
│   │   ├── layout.tsx      # Sidebar navigation, role-based visibility
│   │   ├── page.tsx        # Dashboard with stats
│   │   ├── mods/           # Mod management
│   │   ├── games/          # Game management
│   │   ├── series/         # Series management
│   │   ├── teams/          # Team management
│   │   ├── users/          # User management
│   │   ├── comments/       # Comment moderation
│   │   ├── endorsements/   # Endorsement management
│   │   ├── reports/        # Report handling
│   │   ├── settings/       # Site settings
│   │   ├── tiers/          # Tier rules
│   │   ├── special-roles/  # Special role assignment
│   │   ├── audit/          # Audit logs
│   │   ├── tier-history/   # Tier change history
│   │   ├── news/           # News management
│   │   ├── ads/            # Advertisement management
│   │   ├── analytics/      # Analytics dashboard
│   │   └── login/          # Admin login
│   └── api/                # REST API routes (20+ groups)
│       ├── auth/           # Authentication endpoints
│       ├── mods/           # Mod CRUD
│       ├── games/          # Game CRUD
│       ├── series/         # Series CRUD
│       ├── teams/          # Team CRUD
│       ├── users/          # User management
│       ├── comments/       # Comment system
│       ├── bookmarks/      # Bookmark system
│       ├── notifications/  # Notification system
│       ├── reports/        # Report system
│       ├── search/         # Search functionality
│       ├── settings/       # Site settings
│       ├── stats/          # Statistics
│       ├── news/           # News management
│       ├── ads/            # Advertisement management
│       ├── home/           # Homepage data
│       ├── authors/        # Author data
│       ├── youtube/        # YouTube integration
│       └── admin/          # Admin API (20 sub-routes)
├── views/                  # 24 view components (SPA pages)
│   ├── home.tsx            # Homepage with hero, platforms, sidebar
│   ├── mod-detail.tsx      # Individual mod page
│   ├── search.tsx          # Search page
│   ├── upload.tsx          # Mod upload form
│   ├── profile.tsx         # User profile
│   ├── login.tsx           # Login page (OAuth + Telegram)
│   ├── series.tsx          # Series listing
│   ├── series-detail.tsx   # Individual series page
│   ├── translation-teams.tsx # Teams listing
│   ├── team-detail.tsx     # Individual team page
│   ├── platform.tsx        # Platform-specific mod listing
│   ├── support.tsx         # Support page
│   ├── explore.tsx         # Explore page
│   ├── community.tsx       # Community page
│   ├── about.tsx           # About page
│   ├── problems.tsx        # Known problems
│   ├── terms.tsx           # Terms of service
│   ├── privacy.tsx         # Privacy policy
│   ├── notifications.tsx   # User notifications
│   ├── settings.tsx        # User settings
│   └── coming-soon.tsx     # Placeholder for unknown views
├── components/             # 35 components
│   ├── ui/                 # 40+ shadcn/ui primitives
│   ├── admin/              # Admin-specific components
│   ├── profile/            # Profile-related components
│   ├── navbar.tsx          # Main navigation
│   ├── footer.tsx          # Site footer
│   ├── hero-slider.tsx     # Homepage hero carousel
│   ├── mod-card.tsx        # Mod listing card
│   ├── game-card.tsx       # Game listing card
│   ├── mod-comments.tsx    # Comment system
│   ├── notification-bell.tsx # Notification bell
│   ├── notification-dropdown.tsx # Notification dropdown
│   ├── report-dialog.tsx   # Report dialog
│   ├── report-button.tsx   # Report button
│   ├── telegram-login.tsx  # Telegram Deep Link UI
│   ├── tier-badge.tsx      # User tier display
│   └── ...
├── lib/                    # 26 library/utility files
│   ├── auth.ts             # Core auth functions
│   ├── db.ts               # Prisma client
│   ├── types.ts            # Shared TypeScript interfaces
│   ├── format.ts           # Number formatting, timeAgo
│   ├── constants.ts        # Platform constants
│   ├── supabase/           # Supabase client setup
│   ├── admin/              # Admin utilities
│   ├── reports/            # Report system utilities
│   ├── notifications/      # Notification helpers
│   ├── ip-ban-cache.ts     # Upstash Redis IP ban
│   ├── rate-limit.ts       # Rate limiting
│   ├── tier-engine.ts      # Auto-tier upgrade logic
│   └── ...
├── hooks/                  # 7 custom hooks
├── contexts/               # BookmarksContext
└── __tests__/              # Jest tests
    └── notifications/
        └── handlers.test.ts
```

### Configuration Files

```
games-arabic-main/
├── next.config.ts          # Next.js config (standalone, security headers, CSP)
├── tailwind.config.ts      # Tailwind config (shadcn/ui theme, dark mode)
├── tsconfig.json           # TypeScript config (@/* alias, strict mode)
├── postcss.config.mjs      # PostCSS config (@tailwindcss/postcss)
├── eslint.config.mjs       # ESLint config (very permissive)
├── jest.config.ts          # Jest config (ts-jest, @/ alias)
├── components.json         # shadcn/ui config (New York style)
├── .env.example            # Environment variable template
├── Caddyfile               # Reverse proxy config (port 81 → 3000)
└── package.json            # Dependencies and scripts
```

---

## 4. Database Schema

### Overview

The database uses PostgreSQL with Prisma ORM, containing 30+ models organized into logical groups.

### Core Models

#### User

```prisma
model User {
  id                     String                  @id @default(cuid())
  supabaseId             String?                 @unique
  username               String                  @unique
  email                  String                  @unique
  password               String?                 // deprecated
  provider               String                  @default("email")
  providerAccountId      String?
  avatarUrl              String?
  bannerUrl              String?
  bio                    String?
  websiteUrl             String?
  twitterUrl             String?
  instagramUrl           String?
  tiktokUrl              String?
  youtubeUrl             String?
  githubUrl              String?
  discordUrl             String?
  accentColor            String?                 @default("#ff8c00")
  profileVisibility      String                  @default("everyone")
  hideJoinDate           Boolean                 @default(false)
  role                   String                  @default("member")
  bannedUntil            DateTime?
  banStatus              String                  @default("active")
  banReason              String?
  bannedBy               String?
  bannedAt               DateTime?
  tokenVersion           Int                     @default(0)
  tier                   Int                     @default(0)
  specialRoles           String                  @default("")
  qualityScore           Float                   @default(0)
  lastTierUpgradeAt      DateTime?
  tierUpgradeCount       Int                     @default(0)
  lastLoginAt            DateTime?
  loginCount             Int                     @default(0)
  emailVerified          Boolean                 @default(false)
  joinedAt               DateTime                @default(now())
  createdAt              DateTime                @default(now())
  updatedAt              DateTime                @updatedAt
  // Relations...
}
```

**Roles:**
- `member` - Regular user (default)
- `moderator` - Can publish/edit own mods
- `admin` - Full access to most features
- `owner` - Complete system access

**Tiers:**
- `0` - مبتدئ (Beginner)
- `1` - مترجم (Translator)
- `2` - محترف (Professional)
- `3` - خبير (Expert)
- `4` - مشرف (Supervisor)
- `5` - مدير (Manager)

#### Game

```prisma
model Game {
  id                String     @id @default(cuid())
  slug              String     @unique
  name              String
  tagline           String
  description       String
  bannerUrl         String
  logoUrl           String?
  thumbnailUrl      String
  category          String     // RPG | FPS | Strategy | Sandbox | Adventure | Simulation
  platform          String     // PC | NS | PS1 | PS2 | PS3 | PS4 | X360
  releaseYear       Int
  modCount          Int        @default(0)
  totalDownloads    Int        @default(0)
  totalEndorsements Int        @default(0)
  featured          Boolean    @default(false)
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  mods              Mod[]
  categories        Category[]
}
```

#### Mod

```prisma
model Mod {
  id                 String           @id @default(cuid())
  slug               String           @unique
  name               String
  summary            String
  description        String
  changelog          String           @default("")
  installGuide       String           @default("")
  arabicTitle        String           @default("")
  compatibility      String           @default("")
  authorId           String
  gameId             String
  categoryId         String?
  thumbnailUrl       String
  imageUrl           String
  galleryUrls        String           // comma-separated
  version            String
  fileSize           String
  fileFormat         String           // 7z | zip | rar
  downloads          Int              @default(0)
  endorsements       Int              @default(0)
  views              Int              @default(0)
  comments           Int              @default(0)
  rating             Float            @default(0)
  ratingCount        Int              @default(0)
  tags               String           // comma-separated
  series             String           @default("")
  seriesId           String?
  translationTeam    String           @default("")
  teamId             String?
  isFeatured         Boolean          @default(false)
  isTrending         Boolean          @default(false)
  isLatest           Boolean          @default(true)
  translationType    String           @default("unofficial")
  releaseDate        DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  createdAt          DateTime         @default(now())
  // Relations...
}
```

### Related Models

#### ModFile & ModFileLink

Multi-file download system with multiple mirror links:

```prisma
model ModFile {
  id          String        @id @default(cuid())
  modId       String
  title       String
  description String?
  alert       String?
  version     String
  releaseDate DateTime      @default(now())
  fileSize    String
  fileFormat  String
  order       Int           @default(0)
  links       ModFileLink[]
  createdAt   DateTime      @default(now())
}

model ModFileLink {
  id        String   @id @default(cuid())
  fileId    String
  url       String
  label     String?
  order     Int      @default(0)
  createdAt DateTime @default(now())
}
```

#### ModVideoGroup & ModVideo

Organized video sections:

```prisma
model ModVideoGroup {
  id        String     @id @default(cuid())
  modId     String
  name      String
  order     Int        @default(0)
  videos    ModVideo[]
  createdAt DateTime   @default(now())
}

model ModVideo {
  id            String        @id @default(cuid())
  groupId       String
  title         String
  url           String
  thumbnail     String?
  duration      String?
  description   String?
  views         Int           @default(0)
  likes         Int           @default(0)
  commentsCount Int           @default(0)
  channel       String?
  order         Int           @default(0)
  createdAt     DateTime      @default(now())
}
```

#### Series

Game series grouping:

```prisma
model Series {
  id                String   @id @default(cuid())
  slug              String   @unique
  name              String
  description       String   @default("")
  bannerUrl         String   @default("")
  logoUrl           String   @default("")
  color             String   @default("")
  isFeatured        Boolean  @default(false)
  isOfficial        Boolean  @default(false)
  order             Int      @default(0)
  modCount          Int      @default(0)
  totalDownloads    Int      @default(0)
  totalEndorsements Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  mods              Mod[]
}
```

#### Team & TeamMembership

Translation team management:

```prisma
model Team {
  id           String            @id @default(cuid())
  slug         String            @unique
  name         String
  description  String            @default("")
  logoUrl      String            @default("")
  bannerUrl    String            @default("")
  websiteUrl   String            @default("")
  discordUrl   String            @default("")
  isOfficial   Boolean           @default(false)
  isFeatured   Boolean           @default(false)
  ownerId      String?
  order        Int               @default(0)
  modCount     Int               @default(0)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  mods         Mod[]
  memberships  TeamMembership[]
  contactLinks TeamContactLink[]
}

model TeamMembership {
  id        String   @id @default(cuid())
  teamId    String
  userId    String?
  name      String
  avatarUrl String?
  role      String   @default("member")
  bio       String?
  joinedAt  DateTime @default(now())
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

### Social Features

#### Endorsement

```prisma
model Endorsement {
  id        String   @id @default(cuid())
  userId    String
  modId     String
  value     String   @default("up")  // up | down
  createdAt DateTime @default(now())
}
```

#### Bookmark

```prisma
model Bookmark {
  id        String   @id @default(cuid())
  userId    String
  modId     String
  createdAt DateTime @default(now())
}
```

#### CommentLike

```prisma
model CommentLike {
  id        String   @id @default(cuid())
  userId    String
  commentId String
  value     String   @default("like")  // like | dislike
  createdAt DateTime @default(now())
}
```

#### Follow

```prisma
model Follow {
  id          String   @id @default(cuid())
  followerId  String
  followingId String
  createdAt   DateTime @default(now())
}
```

### System Models

#### AuditLog

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  username  String   @default("system")
  action    String   // create | update | delete | login | logout | moderate
  entity    String   // mod | game | user | comment | ad | series | setting
  entityId  String?
  details   String?  // JSON string with extra info
  ipAddress String?
  createdAt DateTime @default(now())
}
```

#### SiteSetting

```prisma
model SiteSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  group     String   @default("general")
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}
```

#### IpBan

```prisma
model IpBan {
  id               String    @id @default(cuid())
  ipAddress        String    @unique
  reason           String?
  bannedBy         String?
  bannedByUsername String?
  expiresAt        DateTime?  // null = permanent
  createdAt        DateTime  @default(now())
}
```

### Gamification Models

#### TierRule

```prisma
model TierRule {
  id                   String   @id @default(cuid())
  tier                 Int      @unique
  name                 String
  nameEn               String
  requiredMods         Int      @default(0)
  requiredDownloads    Int      @default(0)
  requiredRating       Float    @default(0)
  requiredQualityScore Float    @default(0)
  badge                String   @default("")
  badgeColor           String   @default("#6b7280")
  features             String   @default("[]")
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

#### TierHistory

```prisma
model TierHistory {
  id          String    @id @default(cuid())
  userId      String
  fromTier    Int
  toTier      Int
  reason      String    @default("auto")
  triggeredBy String?
  notes       String?
  createdAt   DateTime  @default(now())
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### SpecialRole

```prisma
model SpecialRole {
  id          String   @id @default(cuid())
  key         String   @unique
  name        String
  nameEn      String
  icon        String   @default("Star")
  color       String   @default("#6b7280")
  description String   @default("")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Content Models

#### News

```prisma
model News {
  id         String    @id @default(cuid())
  slug       String    @unique
  title      String
  summary    String    @default("")
  content    String    @default("")
  imageUrl   String    @default("")
  linkUrl    String?
  category   String    @default("general")
  type       String    @default("ticker")
  isSticky   Boolean   @default(false)
  isAnimated Boolean   @default(true)
  visible    Boolean   @default(true)
  order      Int       @default(0)
  views      Int       @default(0)
  publishAt  DateTime  @default(now())
  expiresAt  DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
```

#### HomepageAd

```prisma
model HomepageAd {
  id          String   @id @default(cuid())
  type        String   @default("youtube")
  url         String
  title       String   @default("")
  description String   @default("")
  link        String?
  size        String   @default("medium")
  order       Int      @default(0)
  visible     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Report System

#### Report

```prisma
model Report {
  id              String         @id @default(cuid())
  reporterId      String?
  targetType      String         // mod | comment | user
  targetModId     String?
  targetCommentId String?
  targetUserId    String?
  reason          String
  priority        String         @default("medium")
  description     String?
  evidenceUrls    String?
  status          String         @default("new")
  assignedToId    String?
  resolution      String?
  resolvedAt      DateTime?
  actionTaken     String?
  actionAt        DateTime?
  fraudScore      Float          @default(0)
  repeatOffenseLevel Int         @default(0)
  ipAddress       String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

#### ReportFraudSignal

```prisma
model ReportFraudSignal {
  id          String   @id @default(cuid())
  reportId    String
  signalType  String   // duplicate_pattern | timing_anomaly | target_harassment | low_trust_reporter | same_target_swarm
  score       Float    // 0.0 - 1.0
  description String
  createdAt   DateTime @default(now())
}
```

### Notification System

#### Notification

```prisma
model Notification {
  id        String    @id @default(cuid())
  userId    String
  actorId   String?
  type      String
  title     String
  message   String
  data      Json?
  isRead    Boolean   @default(false)
  readAt    DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  user      User      @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  actor     User?     @relation("ActorNotifications", fields: [actorId], references: [id], onDelete: SetNull)
  logs      NotificationLog[]
}
```

#### NotificationPreference

```prisma
model NotificationPreference {
  id                  String   @id @default(cuid())
  userId              String   @unique
  emailEnabled        Boolean  @default(true)
  pushEnabled         Boolean  @default(true)
  dailySummary        Boolean  @default(true)
  summaryIntervalDays Int      @default(3)
  likeThreshold       Int      @default(25)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### Entity Relationships

```
User ──┬──< Mod >── ModFile >── ModFileLink
       ├──< Mod >── ModVideoGroup >── ModVideo
       ├──< Mod >── ModTeamMember
       ├──< Mod >── ModContactLink
       ├──< Mod >── ModCustomTab
       ├──< TeamMembership >── Team >── TeamContactLink
       ├──< ModComment >── Mod
       ├──< Endorsement >── Mod
       ├──< Bookmark >── Mod
       ├──< CommentLike >── ModComment
       ├──< Follow (follower) >── User
       ├──< Follow (following) >── User
       ├──< Notification >── User
       ├──< NotificationPreference >── User
       ├──< TierHistory >── User
       ├──< UserTrustScore >── User
       ├──< Report (reporter) >── User
       ├──< Report (target) >── User
       ├──< Report (assigned) >── User
       └──< UserAction >── User
```

---

## 5. API Reference

### Authentication Endpoints

```
POST /api/auth/callback         # OAuth callback handler
POST /api/auth/change-password  # Change user password
GET  /api/auth/check-email      # Check if email exists
POST /api/auth/login            # Admin login (username/password)
POST /api/auth/logout           # Logout user
GET  /api/auth/me               # Get current user
POST /api/auth/register         # Register new user
POST /api/auth/sync-user        # Sync Supabase user with Neon DB
POST /api/auth/telegram         # Telegram Deep Link auth
POST /api/auth/user-login       # User login
```

### Mod Endpoints

```
GET    /api/mods                # List mods (with filters)
POST   /api/mods                # Create new mod
GET    /api/mods/[id]           # Get mod details
PUT    /api/mods/[id]           # Update mod
DELETE /api/mods/[id]           # Delete mod
```

### Game Endpoints

```
GET    /api/games               # List games (with filters)
POST   /api/games               # Create new game
GET    /api/games/[id]          # Get game details
PUT    /api/games/[id]          # Update game
DELETE /api/games/[id]          # Delete game
```

### Series Endpoints

```
GET    /api/series              # List series
POST   /api/series              # Create new series
GET    /api/series/[id]         # Get series details
PUT    /api/series/[id]         # Update series
DELETE /api/series/[id]         # Delete series
```

### Team Endpoints

```
GET    /api/teams               # List teams
POST   /api/teams               # Create new team
GET    /api/teams/[id]          # Get team details
PUT    /api/teams/[id]          # Update team
DELETE /api/teams/[id]          # Delete team
```

### User Endpoints

```
GET    /api/users               # List users (admin)
GET    /api/users/[id]          # Get user details
PUT    /api/users/[id]          # Update user
DELETE /api/users/[id]          # Delete user
```

### Comment Endpoints

```
GET    /api/comments            # List comments
POST   /api/comments            # Create comment
PUT    /api/comments/[id]       # Update comment
DELETE /api/comments/[id]       # Delete comment
```

### Bookmark Endpoints

```
GET    /api/bookmarks           # List user bookmarks
POST   /api/bookmarks           # Add bookmark
DELETE /api/bookmarks/[id]      # Remove bookmark
```

### Notification Endpoints

```
GET    /api/notifications       # List user notifications
PUT    /api/notifications/[id]  # Mark notification as read
PUT    /api/notifications/read-all # Mark all as read
```

### Report Endpoints

```
GET    /api/reports             # List reports (admin)
POST   /api/reports             # Create report
PUT    /api/reports/[id]        # Update report (admin)
```

### Search Endpoints

```
GET    /api/search              # Search mods and games
```

### Settings Endpoints

```
GET    /api/settings            # Get site settings
PUT    /api/settings            # Update settings (admin)
```

### Stats Endpoints

```
GET    /api/stats               # Get site statistics
```

### News Endpoints

```
GET    /api/news                # List news
POST   /api/news                # Create news (admin)
PUT    /api/news/[id]           # Update news (admin)
DELETE /api/news/[id]           # Delete news (admin)
```

### Ad Endpoints

```
GET    /api/ads                 # List ads
POST   /api/ads                 # Create ad (admin)
PUT    /api/ads/[id]            # Update ad (admin)
DELETE /api/ads/[id]            # Delete ad (admin)
```

### Home Endpoints

```
GET    /api/home                # Get homepage data
```

### Author Endpoints

```
GET    /api/authors             # List authors
GET    /api/authors/[id]        # Get author details
```

### YouTube Endpoints

```
GET    /api/youtube             # YouTube integration
```

### Admin API Endpoints

```
GET    /api/admin/mods          # Admin mod management
GET    /api/admin/games         # Admin game management
GET    /api/admin/users         # Admin user management
GET    /api/admin/comments      # Admin comment management
GET    /api/admin/reports       # Admin report management
GET    /api/admin/settings      # Site settings
GET    /api/admin/tiers         # Tier rules
GET    /api/admin/special-roles # Special roles
GET    /api/admin/audit         # Audit logs
GET    /api/admin/analytics     # Analytics data
```

### Authentication in API

All protected endpoints require:

1. **Supabase Auth Token** in `Authorization` header
2. **JWT Role Cookie** (`ga_admin_role`) for Edge middleware

```typescript
// Example: Protected API route
export async function GET(req: NextRequest) {
  const user = await requireAuth();  // Throws 401 if not authenticated
  // ... process request
}
```

### Rate Limiting

Rate limiting is implemented via Upstash Redis:

- **Auth endpoints:** 10 requests/minute
- **Comment endpoints:** 30 requests/minute
- **Mod endpoints:** 60 requests/minute
- **General API:** 100 requests/minute

---

## 6. Authentication System

### Login Methods

| Method | Status | Route | Description |
|--------|--------|-------|-------------|
| Google OAuth | Enabled | `/?view=login` | Standard OAuth 2.0 flow |
| Discord OAuth | Enabled | `/?view=login` | Standard OAuth 2.0 flow |
| Telegram Deep Link | Enabled | `/?view=login` | Custom flow via bot |
| Admin Login | Enabled | `/admin/login` | Username/password for admin panel |

### OAuth Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │────▶│   Provider   │────▶│   Supabase   │
│   (Browser)  │     │ (Google/     │     │   Auth       │
│              │     │  Discord)    │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                           │                      │
                           │   Callback           │
                           ▼                      ▼
                    ┌──────────────┐     ┌──────────────┐
                    │   Next.js    │◀────│   JWT Token  │
                    │   Callback   │     │              │
                    └──────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Set Cookie │
                    │   (role)     │
                    └──────────────┘
```

### JWT Role Cookie

The role cookie is a signed JWT containing:

```typescript
interface RoleCookiePayload {
  userId: string;
  role: 'member' | 'moderator' | 'admin' | 'owner';
  tv: number;  // tokenVersion - for session invalidation
}
```

**Cookie Properties:**
- Name: `ga_admin_role`
- Duration: 7 days
- HttpOnly: true
- Secure: true (production)
- SameSite: lax

### Edge Middleware

The middleware runs in Edge runtime and handles:

1. **Session Refresh** - Updates Supabase session for all routes
2. **IP Ban Checking** - For sensitive API paths (auth, comments, mods)
3. **Admin Route Protection** - Verifies role cookie for `/admin/*` and `/api/admin/*`

```typescript
// src/middleware.ts
export async function middleware(req: NextRequest) {
  // 1. Update Supabase session
  const { supabase, response } = await updateSession(req);
  
  // 2. Check IP bans for sensitive paths
  if (pathname.startsWith('/api/auth') || ...) {
    const ipBan = await getIpBanCache(ip);
    if (ipBan?.banned) {
      return NextResponse.json({ error: 'IP_BANNED' }, { status: 403 });
    }
  }
  
  // 3. Protect admin routes
  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.includes(pathname)) {
    const rolePayload = await getRoleFromCookie(req);
    if (!rolePayload?.role || !user) {
      return NextResponse.redirect(loginUrl);
    }
  }
  
  return response;
}
```

### Authorization Helpers

```typescript
// Require authentication
export async function requireAuth(): Promise<SessionUser>

// Require admin role
export async function requireAdmin(): Promise<SessionUser>

// Require owner role
export async function requireOwner(): Promise<SessionUser>

// Require moderator role
export async function requireModerator(): Promise<SessionUser>

// Check if user can edit a mod
export function canEditMod(user: SessionUser, mod: { authorId: string }): boolean

// Check if user can delete
export function canDelete(user: SessionUser): boolean
```

### Ban System

```typescript
interface BanStatusResult {
  banned: boolean;
  type: 'temp' | 'perm' | null;
  expiresAt: Date | null;
  reason: string | null;
}

// Check ban status
export function getBanStatus(user: {
  banStatus?: string | null;
  bannedUntil?: Date | null;
  banReason?: string | null;
}): BanStatusResult

// Invalidate all user sessions
export async function invalidateUserSessions(userId: string): Promise<void>

// Check IP ban (server-side)
export async function checkIpBan(ip: string): Promise<{ banned: boolean; ... }>

// Get client IP
export function getClientIp(req: { headers: Headers }): string
```

### Session Invalidation

When a user is banned or their role changes:

1. `tokenVersion` is incremented in the database
2. All existing role cookies become invalid
3. User is logged out on next request

```typescript
export async function invalidateUserSessions(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}
```

---

## 7. UI Components

### View Switching System

The app uses a SPA pattern with query parameter routing:

```typescript
// src/app/page.tsx
const view = searchParams.get('view') || 'home';

// Lazy-loaded view components
const HomePage = dynamic(() => import('@/views/home').then(m => ({ default: m.HomePage })));
const ModDetailPage = dynamic(() => import('@/views/mod-detail').then(m => ({ default: m.ModDetailPage })));
// ... etc

// Render based on view
{view === 'home' && <HomePage />}
{view === 'mod' && <ModDetailPage />}
// ... etc
```

### Main Components

#### Layout Components

- **Navbar** (`components/navbar.tsx`) - Main navigation with games dropdown
- **Footer** (`components/footer.tsx`) - Site footer
- **HeroSlider** (`components/hero-slider.tsx`) - Homepage hero carousel

#### Feature Components

- **ModCard** (`components/mod-card.tsx`) - Mod listing card
- **GameCard** (`components/game-card.tsx`) - Game listing card
- **ModComments** (`components/mod-comments.tsx`) - Comment system
- **NotificationBell** (`components/notification-bell.tsx`) - Notification bell
- **NotificationDropdown** (`components/notification-dropdown.tsx`) - Notification dropdown
- **ReportDialog** (`components/report-dialog.tsx`) - Report dialog
- **ReportButton** (`components/report-button.tsx`) - Report button
- **TelegramLogin** (`components/telegram-login.tsx`) - Telegram Deep Link UI
- **TierBadge** (`components/tier-badge.tsx`) - User tier display

#### UI Primitives (shadcn/ui)

40+ components under `components/ui/`:

- Accordion, AlertDialog, AspectRatio, Avatar
- Button, Calendar, Card, Checkbox
- Collapsible, ContextMenu, Dialog
- DropdownMenu, HoverCard, Input
- Label, Menubar, NavigationMenu
- Popover, Progress, RadioGroup
- ScrollArea, Select, Separator
- Slider, Switch, Tabs
- Toast, Toggle, ToggleGroup
- Tooltip, Table, Form
- Command, Sheet, Skeleton

### Theme System

#### Colors

The app uses a custom theme with oklch color space:

```css
/* src/app/globals.css */
:root {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.265 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  /* ... more colors */
}
```

#### Gradients

Custom gradient system for accents:

```css
.gradient-primary {
  background: linear-gradient(135deg, #ff8c00 0%, #8b5cf6 100%);
}
```

### RTL Layout

The app is Arabic-first with `dir="rtl"` on the root HTML element:

```html
<html lang="ar" dir="rtl" suppressHydrationWarning className="dark">
```

### Fonts

- **Cairo** - Arabic font for body text
- **Geist** - Latin font for code and numbers

### Animations

Using Framer Motion for smooth transitions:

```typescript
// Page transitions
<div
  className="page-transition"
  style={{
    opacity: transitioning ? 0 : 1,
    transform: transitioning ? 'translateY(8px)' : 'translateY(0)',
    transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
  }}
>
```

---

## 8. Admin Panel

### Structure

```
/admin/
├── layout.tsx           # Sidebar navigation, role-based visibility
├── page.tsx             # Dashboard with stats
├── login/               # Admin login
├── mods/                # Mod management
├── games/               # Game management
├── series/              # Series management
├── teams/               # Team management
├── users/               # User management
├── comments/            # Comment moderation
├── endorsements/        # Endorsement management
├── reports/             # Report handling
├── settings/            # Site settings
├── tiers/               # Tier rules
├── special-roles/       # Special role assignment
├── audit/               # Audit logs
├── tier-history/        # Tier change history
├── news/                # News management
├── ads/                 # Advertisement management
└── analytics/           # Analytics dashboard
```

### Role-Based Visibility

The sidebar shows/hides sections based on user role:

```typescript
// src/app/admin/layout.tsx
const canSee = (requiredRole: string) => {
  const roleHierarchy = { owner: 4, admin: 3, moderator: 2, member: 1 };
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
};
```

**Section Access:**

| Section | Owner | Admin | Moderator |
|---------|-------|-------|-----------|
| Dashboard | ✓ | ✓ | ✓ |
| Mods | ✓ | ✓ | ✓ (own only) |
| Games | ✓ | ✓ | ✗ |
| Series | ✓ | ✓ | ✗ |
| Teams | ✓ | ✓ | ✗ |
| Users | ✓ | ✓ | ✗ |
| Comments | ✓ | ✓ | ✓ |
| Endorsements | ✓ | ✓ | ✗ |
| Reports | ✓ | ✓ | ✓ |
| Settings | ✓ | ✗ | ✗ |
| Tiers | ✓ | ✗ | ✗ |
| Special Roles | ✓ | ✗ | ✗ |
| Audit | ✓ | ✗ | ✗ |
| Tier History | ✓ | ✗ | ✗ |
| News | ✓ | ✓ | ✗ |
| Ads | ✓ | ✗ | ✗ |
| Analytics | ✓ | ✓ | ✗ |

### Dashboard Stats

The admin dashboard displays:

- Total Games
- Total Mods
- Total Users
- Total Downloads
- Total Endorsements
- Total Comments
- Featured Mods
- Trending Mods
- Total Series

---

## 9. Deployment

### Build Process

```bash
# Build script (from package.json)
npx prisma generate && npx prisma migrate deploy && next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
```

**Steps:**
1. `prisma generate` - Generate Prisma client
2. `prisma migrate deploy` - Apply database migrations
3. `next build` - Build Next.js application
4. Copy static files to standalone output

### Standalone Output

The app uses Next.js standalone output mode:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
  // ...
};
```

**Output Location:** `.next/standalone/`

### Caddy Configuration

```caddy
# Caddyfile
:81 {
    handle {
        reverse_proxy localhost:3000 {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
        }
    }
}
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# Auth
JWT_SECRET="generate-with: openssl rand -base64 32"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_DB_URL="postgresql://postgres:password@db.your-project.supabase.co:5432/postgres"

# OAuth Providers
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_BOT_NAME=""

# Email (Resend)
RESEND_API_KEY="re_your_api_key"
EMAIL_FROM="noreply@yourdomain.com"

# Site
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
```

### Running in Production

```bash
# Start production server
NODE_ENV=production bun .next/standalone/server.js
```

### Security Headers

```typescript
// next.config.ts
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: '...' },
];
```

---

## 10. Development Guide

### Getting Started

```bash
# 1. Install dependencies
bun install

# 2. Set up environment
cp .env.example .env
# Edit .env with your database URL and API keys

# 3. Run database migrations
bun run db:push

# 4. Seed database (optional)
npx tsx scripts/seed.ts

# 5. Start development server
bun run dev
```

### Available Commands

```bash
bun run dev          # Start development server on :3000
bun run build        # Build for production
bun run lint         # Run ESLint
bun run db:push      # Push schema changes to database
bun run db:generate  # Generate Prisma client
bun run db:migrate   # Create new migration
bun run db:reset     # Reset database
```

### Project Structure Conventions

1. **Views** - Place in `src/views/`, export named component
2. **Components** - Place in `src/components/`, use PascalCase
3. **API Routes** - Place in `src/app/api/`, use Route Handlers
4. **Utilities** - Place in `src/lib/`, use camelCase
5. **Hooks** - Place in `src/hooks/`, prefix with `use`

### Adding a New View

1. Create view component in `src/views/`
2. Add to `KNOWN_VIEWS` set in `src/app/page.tsx`
3. Add dynamic import
4. Add conditional render

```typescript
// src/app/page.tsx
const NewView = dynamic(() => import('@/views/new-view').then(m => ({ default: m.NewView })), { loading: () => <ViewSkeleton /> });

const KNOWN_VIEWS: ReadonlySet<string> = new Set<string>([
  // ... existing views
  'new-view',
]);

// In render
{view === 'new-view' && <NewView />}
```

### Adding a New API Route

1. Create route handler in `src/app/api/`
2. Use `NextRequest` and `NextResponse`
3. Add authentication if needed

```typescript
// src/app/api/new-route/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await requireAuth();  // Optional: require authentication
  // ... process request
  return NextResponse.json({ data: '...' });
}
```

### Testing

```bash
# Run all tests
npx jest

# Run specific test file
npx jest src/__tests__/notifications/handlers.test.ts

# Run with coverage
npx jest --coverage
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests for new features
5. Run `bun run lint` and `bun run build`
6. Create a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use shadcn/ui components when possible
- Keep components small and focused
- Use meaningful variable and function names

### Debugging

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Check for ESLint errors
bun run lint

# View build output
bun run build 2>&1 | tee build.log
```

### Common Issues

1. **Database connection issues** - Check `DATABASE_URL` in `.env`
2. **Auth issues** - Verify Supabase keys and JWT secret
3. **Build failures** - Run `bun run db:generate` first
4. **Rate limiting** - Check Upstash Redis configuration

---

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Supabase Documentation](https://supabase.com/docs)

---

**Last Updated:** 2026-08-01
**Version:** 0.2.0
