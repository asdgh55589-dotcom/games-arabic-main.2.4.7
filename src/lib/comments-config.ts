/**
 * comments-config.ts — كل ثوابت نظام التعليقات في مكان واحد.
 * كانت مبعثرة: PAGE_SIZE/MAX_DEPTH في المكوّن، 2000 في Zod، 5/10 في المسارات.
 * أي تغيير هنا ينعكس على API + Zod + UI معاً.
 */
export const COMMENTS_CONFIG = {
  /** أقصى عمق تداخل مسموح (0 = جذري) */
  maxDepth: 5,
  /** عدد الجذور الافتراضي لصفحة الـGET العام */
  pageSize: 20,
  /** سقف limit الذي يقبله الـGET العام */
  maxPageSize: 50,
  /** طول النص بعد trim */
  minLength: 1,
  maxLength: 2000,
  /** عدد الردود الظاهرة قبل زر "عرض المزيد" */
  visibleReplies: 5,
  /** مهلة جلب التعليقات في الواجهة (ms) */
  fetchTimeoutMs: 10_000,
  /** حد النشر: 5 تعليقات/دقيقة */
  createLimit: 5,
  createWindowSec: 60,
  createKeyPrefix: 'comments:create',
  /** حد التفاعل: 10/دقيقة (مشترك like/dislike بعد الدمج) */
  reactionLimit: 10,
  reactionWindowSec: 60,
  reactionKeyPrefix: 'comments:reaction',
  /** سقف جولات مسح الأحفاد عند الحذف (عمق × هامش أمان) */
  maxDeleteLevels: 10,
} as const
