/**
 * lib/terminology.ts — Project Terminology Dictionary
 *
 * Centralized Arabic terminology for consistent labeling across the admin dashboard.
 * All user-facing strings should reference this file for easy customization.
 */

export const T = {
  // Core concepts
  mod: 'تعريب',
  mods: 'التعريبات',
  game: 'لعبة',
  games: 'الألعاب',
  team: 'فريق',
  teams: 'الفرق',
  user: 'مستخدم',
  users: 'المستخدمون',
  series: 'سلسلة',
  seriesList: 'السلاسل',
  section: 'قسم',
  sections: 'الأقسام',
  category: 'فئة',
  categories: 'الفئات',

  // Actions
  publish: 'نشر',
  approve: 'اعتماد',
  reject: 'رفض',
  archive: 'أرشفة',
  review: 'مراجعة',
  edit: 'تعديل',
  delete: 'حذف',
  create: 'إنشاء',
  save: 'حفظ',
  cancel: 'إلغاء',
  search: 'بحث',
  filter: 'تصفية',
  export: 'تصدير',
  import: 'استيراد',
  duplicate: 'نسخ',
  submit: 'إرسال',
  confirm: 'تأكيد',
  back: 'رجوع',
  next: 'التالي',
  previous: 'السابق',

  // Statuses
  draft: 'مسودة',
  inReview: 'قيد المراجعة',
  approved: 'معتمد',
  published: 'منشور',
  archived: 'مؤرشف',
  rejected: 'مرفوض',
  active: 'نشط',
  inactive: 'غير نشط',
  banned: 'محظور',

  // Roles
  owner: 'مالك',
  admin: 'مدير',
  moderator: 'مشرف',
  member: 'عضو',
  teamLeader: 'قائد الفريق',

  // UI elements
  dashboard: 'لوحة التحكم',
  settings: 'الإعدادات',
  reports: 'البلاغات',
  comments: 'التعليقات',
  analytics: 'التحليلات',
  notifications: 'الإشعارات',
  audit: 'سجل النشاطات',
  ads: 'الإعلانات',
  tiers: 'المستويات',
  specialRoles: 'الأدوار الخاصة',

  // Notifications
  newMod: 'تعريب جديد',
  modApproved: 'تم اعتماد التعريب',
  modRejected: 'تم رفض التعريب',
  modPublished: 'تم نشر التعريب',
  newComment: 'تعليق جديد',
  newReport: 'بلاغ جديد',

  // Platform names
  pc: 'PC',
  nintendoSwitch: 'Nintendo Switch',
  ps4: 'PS4',
  ps3: 'PS3',
  ps2: 'PS2',
  ps1: 'PS1',
  xbox360: 'Xbox 360',

  // Messages
  noData: 'لا توجد بيانات',
  loading: 'جاري التحميل...',
  error: 'حدث خطأ',
  success: 'تم بنجاح',
  confirmDelete: 'هل أنت متأكد من الحذف؟',
  confirmAction: 'هل أنت متأكد من هذا الإجراء؟',
  unauthorized: 'غير مصرح لك بهذا الإجراء',
  notFound: 'غير موجود',
} as const

export type TerminologyKey = keyof typeof T
