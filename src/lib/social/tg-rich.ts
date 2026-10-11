/**
 * lib/social/tg-rich.ts — طبقة تكيّف (adapter) حول `tg-rich-messages`.
 *
 * لماذا طبقة وسيطة؟
 *  1. الحدّ الأدنى من سطح الاستيراد: `rich-post.ts` و`publish.ts` يحتاجان
 *     `doc`/`toHTML`/`toInputRichMessage`/`validate` فقط.
 *  2. الاختبار: `tg-rich-messages` حزمة ESM-only (`type: module`, exports
 *     `import` فقط). Jest هنا يحوّل إلى CJS، فلا يستطيع تحميلها. وحدات
 *     الاختبار تستبدل هذا الملف عبر `jest.mock('@/lib/social/tg-rich', …)`
 *     بمزوّد مطابق للعقد، بينما يغطّي `tsc --noEmit` الاستيراد الحقيقي.
 *
 * المرجع: https://core.telegram.org/bots/api#rich-messages
 *         https://github.com/vdistortion/tg-rich-messages (v0.4.0)
 */
export {
  audio,
  type BlockContent,
  // نماذج
  type BlockNode,
  blockquote,
  // تنسيق سطر
  bold,
  br,
  code,
  type DocumentOptions,
  details,
  divider,
  doc,
  document,
  fmtRich,
  footer,
  heading,
  type Inline,
  type InlineNode,
  type InputRichMessage,
  italic,
  type ListItem,
  type ListItemInput,
  type ListOptions,
  link,
  list,
  type MediaOptions,
  // كتل
  p,
  paragraph,
  // وسائط
  photo,
  pre,
  RichDocument,
  spoiler,
  strike,
  sub,
  sup,
  type TableCell,
  type TableCellInput,
  type TableOptions,
  table,
  underline,
  video,
} from 'tg-rich-messages'
