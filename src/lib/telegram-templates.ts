/**
 * lib/telegram-templates.ts — نظام قوالب منشورات Telegram
 *
 * يدعم متغيرات ديناميكية وقوالب افتراضية قابلة للتخصيص.
 */

export interface TemplateVariables {
  game_name: string
  game_name_en: string
  team_name: string
  platform: string
  version: string
  description: string
  story: string
  download_link: string
  hashtags: string
  publish_date: string
  mod_name: string
  file_size: string
  [key: string]: string
}

export interface TelegramTemplate {
  id: string
  name: string
  content: string
  isDefault: boolean
  createdAt: string
}

const PLATFORM_HASHTAGS: Record<string, string> = {
  NS: '#سويتش',
  PS4: '#بلاي_4',
  PS3: '#بلاي_3',
  PS2: '#بلاي_2',
  PS1: '#بلاي_1',
  X360: '#اكس_بوكس',
  PC: '#كمبيوتر',
}

const DEFAULT_TEMPLATE = `🎮 {game_name}
🏷️ {game_name_en}

📝 التعريب: {team_name}
🎯 المنصة: {platform}
📌 الإصدار: {version}

📖 القصة:
{story}

⬇️ رابط التحميل:
{download_link}

{hashtags}`

/**
 * توليد الهاشتاغات تلقائياً بناءً على بيانات التعريب
 */
export function generateHashtags(gameNameAr: string, platform: string, teamName: string): string {
  const platformTag = PLATFORM_HASHTAGS[platform] || `#${platform}`
  const gameTag = `#${gameNameAr.replace(/\s+/g, '_')}`
  const modTag = `#تعريب_${gameNameAr.replace(/\s+/g, '_')}`
  const teamTag = teamName ? `#${teamName.replace(/\s+/g, '_')}` : ''
  const generalTag = '#تعريبات_العاب'

  return [gameTag, modTag, platformTag, teamTag, generalTag].filter(Boolean).join(' ')
}

/**
 * تقليص القصة إلى 4 أسطر كحد أقصى
 */
export function truncateStory(story: string, maxLines = 4): string {
  if (!story) return 'لا توجد معلومات متاحة'
  const lines = story.split('\n').filter((l) => l.trim())
  if (lines.length <= maxLines) return story
  return lines.slice(0, maxLines).join('\n') + '\n...'
}

/**
 * استبدال المتغيرات في القالب
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '')
  }
  // Clean up empty lines
  result = result.replace(/\n{3,}/g, '\n\n')
  return result.trim()
}

/**
 * القالب الافتراضي
 */
export function getDefaultTemplate(): string {
  return DEFAULT_TEMPLATE
}

/**
 * التحقق من طول المنشور (حد Telegram: 4096)
 */
export function validatePostLength(content: string): {
  valid: boolean
  length: number
  remaining: number
  warning: boolean
} {
  const length = content.length
  const limit = 4096
  return {
    valid: length <= limit,
    length,
    remaining: limit - length,
    warning: length > 4000,
  }
}

/**
 * تنسيق منشور Telegram مع البيانات
 */
export function formatPost(
  mod: {
    name: string
    arabicTitle?: string
    version: string
    description?: string
    summary?: string
    fileSize?: string
    game: { name: string; platform: string }
    teamRelation?: { name: string } | null
    files?: { downloadUrl: string }[]
  },
  template?: string,
  overrides?: Partial<TemplateVariables>,
): { content: string; variables: TemplateVariables } {
  const story = truncateStory(mod.summary || mod.description || '')

  const variables: TemplateVariables = {
    game_name: mod.game.name,
    game_name_en: mod.name,
    team_name: mod.teamRelation?.name || 'فريق غير معروف',
    platform: mod.game.platform,
    version: mod.version,
    description: mod.description || '',
    story,
    download_link: mod.files?.[0]?.downloadUrl || '',
    hashtags: generateHashtags(mod.game.name, mod.game.platform, mod.teamRelation?.name || ''),
    publish_date: new Date().toLocaleDateString('ar-SA'),
    mod_name: mod.arabicTitle || mod.name,
    file_size: mod.fileSize || '',
    ...overrides,
  }

  const content = renderTemplate(template || DEFAULT_TEMPLATE, variables)

  return { content, variables }
}
