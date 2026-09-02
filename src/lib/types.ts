// Updated for new API response format
// Shared API response types — single source of truth for backend → frontend contract.

/**
 * API Response Shapes:
 * - Single resource:  { data: T }
 * - Paginated list:   { data: T[], pagination: { page, limit, total, totalPages } }
 * - Paginated object: { data: { ...fields }, pagination: { page, limit, total, totalPages } }
 * - Error:            { error: { code: string, message: string, details?: unknown } }
 * 
 * Note: ok(value) wraps ANY value in { data: value }.
 * okPaginated(data, pagination) wraps data + adds pagination.
 * The shape of 'data' depends on what the route returns (array vs object).
 */

export interface Author {
  id: string
  username: string
  email?: string
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
  role: string  // member | creator | publisher | moderator | admin | manager | owner
  tier: number
  specialRoles: string
  qualityScore: number
  joinedAt: string | Date
}

export interface GameSummary {
  id: string
  slug: string
  name: string
  tagline: string
  thumbnailUrl: string
  bannerUrl: string
  logoUrl: string | null
  category: string
  platform: string  // PC | PS1 | PS2 | PS3 | PS4
  releaseYear: number
  modCount: number
  totalDownloads: number
  totalEndorsements: number
  featured: boolean
  createdAt: string | Date
  updatedAt: string | Date
}

export interface GameDetail extends GameSummary {
  description: string
  categories: Category[]
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface ModSummary {
  id: string
  slug: string
  name: string
  summary: string
  thumbnailUrl: string
  imageUrl: string
  galleryUrls: string
  version: string
  fileSize: string
  fileFormat: string
  downloads: number
  endorsements: number
  views: number
  comments: number
  rating: number
  ratingCount: number
  tags: string
  series: string  // اسم السلسلة (مثل God of War)
  translationTeam: string  // فريق التعريب أو المترجم المستقل
  translationType: string  // official | unofficial
  isOriginalWork?: boolean
  originalSource?: string | null
  originalAuthor?: string | null
  isFeatured: boolean
  isTrending: boolean
  isLatest: boolean
  releaseDate: string | Date
  updatedAt: string | Date
  createdAt: string | Date
  author: Author
  game: { name: string; slug: string; platform: string }
  category: { name: string; slug: string } | null
}

// ===== أنواع البيانات الجديدة للـ relations =====
export interface ModFileLink {
  id: string
  url: string
  label: string | null
  order: number
}

export interface ModFile {
  id: string
  modId: string
  title: string
  description: string | null
  alert: string | null
  version: string
  releaseDate: string | Date
  updatedAt: string | Date
  fileSize: string
  fileFormat: string
  order: number
  links: ModFileLink[]
}

export interface ModTeamMember {
  id: string
  modId: string
  name: string
  avatarUrl: string | null
  role: string
  contribution: string | null
  order: number
}

export interface ModContactLink {
  id: string
  modId: string
  type: string
  label: string
  url: string
  order: number
}

export interface ModVideo {
  id: string
  groupId: string
  title: string
  url: string
  thumbnail: string | null
  duration: string | null
  description: string | null
  views: number
  likes: number
  commentsCount: number
  channel: string | null
  publishedAt: string | null
  order: number
}

export interface ModVideoGroup {
  id: string
  modId: string
  name: string
  order: number
  videos: ModVideo[]
}

export interface ModCustomTab {
  id: string
  modId: string
  name: string
  slug: string
  content: string
  order: number
  visible: boolean
}

export interface ModCommentType {
  id: string
  modId: string
  userId: string | null
  guestName: string
  guestAvatar: string | null
  parentId: string | null
  text: string
  likes: number
  dislikes: number
  isPinned: boolean
  isEdited: boolean
  createdAt: string | Date
  updatedAt: string | Date
  user?: { id: string; username: string; avatarUrl: string | null; role?: string | null; tier?: number | null; specialRoles?: string | null } | null
  replies?: ModCommentType[]
}

export interface ModDetail extends ModSummary {
  description: string
  changelog: string
  installGuide: string
  arabicTitle: string
  translationScope: string
  compatibility: string
  author: Author
  game: GameSummary
  category: Category | null
  files: ModFile[]
  teamMembers: ModTeamMember[]
  contactLinks: ModContactLink[]
  videoGroups: ModVideoGroup[]
  customTabs: ModCustomTab[]
}

export interface PaginatedResponse<T> {
  data: T
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
export type PaginatedMods = PaginatedResponse<ModSummary[]>

export interface SearchResponse {
  mods: ModSummary[]
  games: GameSummary[]
}

export interface SiteStats {
  games: number
  mods: number
  downloads: number
  endorsements: number
  users: number
}

export interface SeriesSummary {
  name: string
  count: number
  downloads: number
  endorsements: number
  thumbnailUrl: string
}

export interface HomeData {
  stats: SiteStats
  featuredGames: GameSummary[]
  trendingMods: ModSummary[]
  latestMods: ModSummary[]
  topEndorsed: ModSummary[]
  topSeries: SeriesSummary[]
  modsByPlatform: Record<string, ModSummary[]>
}

export interface EndorseResponse {
  data: {
    endorsed: boolean
    endorsements: number
  }
}

export interface DownloadResponse {
  data: {
    downloads: number
  }
}

export interface AuthorModsResponse {
  author: Author
  mods: ModSummary[]
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

// ===== Notification types =====

export interface NotificationActor {
  id: string
  username: string
  avatarUrl: string | null
}

export interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  targetType?: string | null
  targetId?: string | null
  targetSlug?: string | null
  targetTitle?: string | null
  targetUrl?: string | null
  actorUsername?: string | null
  actorAvatarUrl?: string | null
  readAt: string | null
  createdAt: string | Date
  actor: NotificationActor | null
}

export interface NotificationsResponse {
  data: Notification[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  meta: {
    unreadCount: number
  }
}

// ===== Team types =====

export interface TeamMember {
  id: string
  name: string
  avatarUrl: string | null
  role: string
  bio: string | null
  joinedAt?: string
  username?: string | null
}

export interface TeamMod {
  id: string
  name: string
  slug: string
  thumbnailUrl: string
  downloads: number
  endorsements: number
  views: number
  game: { platform: string; name: string } | null
}

export interface TeamContactLink {
  type: string
  label: string
  url: string
}

export interface TeamCustomTab {
  id: string
  title: string
  content: string
  order: number
  visible: boolean
}

export interface TeamStats {
  modCount: number
  totalDownloads: number
  totalEndorsements: number
  totalViews: number
  profileViews: number
  memberCount: number
  followersCount: number
  platforms: Record<string, number>
  roleBreakdown: Record<string, number>
}

export interface TeamDetail {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  websiteUrl: string
  discordUrl: string
  telegramUrl: string
  isFeatured: boolean
  isOfficial: boolean
  ownerId?: string | null
  hiddenTabs: string
  createdAt: string
  memberships: TeamMember[]
  mods: TeamMod[]
  contactLinks: TeamContactLink[]
  customTabs: TeamCustomTab[]
  stats: TeamStats
}
