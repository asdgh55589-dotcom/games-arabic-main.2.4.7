// Shared API response types — single source of truth for backend → frontend contract.

export interface Author {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
  role: string  // member | moderator | admin | owner
  tier: number
  specialRoles: string
  qualityScore: number
  joinedAt: string
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
  createdAt: string
  updatedAt: string
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
  isFeatured: boolean
  isTrending: boolean
  isLatest: boolean
  releaseDate: string
  updatedAt: string
  createdAt: string
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
  releaseDate: string
  updatedAt: string
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
  createdAt: string
  updatedAt: string
  user?: { id: string; username: string; avatarUrl: string | null } | null
  replies?: ModCommentType[]
}

export interface ModDetail extends ModSummary {
  description: string
  changelog: string
  arabicTitle: string
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

export interface PaginatedMods {
  mods: ModSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

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
  endorsed: boolean
  endorsements: number
}

export interface DownloadResponse {
  downloads: number
}

export interface AuthorModsResponse {
  author: Author
  mods: ModSummary[]
}

export interface ApiError {
  error: string
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
  readAt: string | null
  createdAt: string
  actor: NotificationActor | null
}

export interface NotificationsResponse {
  notifications: Notification[]
  total: number
  unreadCount: number
  page: number
  limit: number
  totalPages: number
}
