/**
 * lib/social/destination-health.ts — فحص صحة وجهة تليجرام عبر Bot API.
 *
 * التسلسل: getMe (معرّف البوت) → getChat (نوع الوجهة الحقيقي/الاسم) →
 * getChatMember (هل البوت ما يزال عضواً/مشرفاً يستطيع النشر).
 *
 * قاعدة أمنية صارمة: التوكن يُمرَّر دخولاً فقط ويُستخدم في عنوان الطلب
 * لا غير — لا يُرجع في أي نتيجة، ولا يُسجَّل في أي نص خطأ أو سجل.
 * أوصاف أخطاء تليجرام الإنجليزية تُترجم لرسائل عربية آمنة.
 */

const TELEGRAM_API = 'https://api.telegram.org/bot'
const HEALTH_TIMEOUT_MS = 10_000

export interface DestinationHealthChat {
  id: number | string
  type: string
  title?: string
  username?: string
}

export interface DestinationHealthResult {
  ok: boolean
  chat?: DestinationHealthChat
  /** حالة عضوية البوت: creator | administrator | member | restricted | left | kicked */
  memberStatus?: string
  /** هل يستطيع البوت النشر في الوجهة؟ */
  canPost?: boolean
  /** رسالة عربية آمنة (بلا توكن) عند الفشل. */
  error?: string
}

interface BotApiEnvelope {
  ok: boolean
  result?: Record<string, any>
  description?: string
}

async function botApi(
  token: string,
  method: 'getMe' | 'getChat' | 'getChatMember',
  params?: Record<string, unknown>,
): Promise<BotApiEnvelope> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS)
  try {
    const res = await fetch(`${TELEGRAM_API}${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params ?? {}),
      signal: ctrl.signal,
    })
    return (await res.json()) as BotApiEnvelope
  } catch {
    return { ok: false, description: 'NETWORK_ERROR' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * فحص صحة وجهة. لا يرمي أبداً — الفشل يعود ضمن النتيجة.
 */
export async function checkDestinationHealth(input: {
  chatId: string
  botToken: string
}): Promise<DestinationHealthResult> {
  const { chatId, botToken } = input
  if (!botToken) {
    return { ok: false, error: 'لا يوجد توكن بوت لفحص الوجهة' }
  }

  const me = await botApi(botToken, 'getMe')
  if (!me.ok || typeof me.result?.id !== 'number') {
    return {
      ok: false,
      error:
        me.description === 'NETWORK_ERROR'
          ? 'تعذّر الوصول إلى تليجرام — تحقق من الشبكة ثم أعد الفحص'
          : 'توكن البوت غير صالح (فشل getMe) — راجع إعداد البوت',
    }
  }

  const chat = await botApi(botToken, 'getChat', { chat_id: chatId })
  if (!chat.ok || !chat.result) {
    return {
      ok: false,
      error:
        chat.description === 'NETWORK_ERROR'
          ? 'تعذّر الوصول إلى تليجرام — تحقق من الشبكة ثم أعد الفحص'
          : 'تعذّر قراءة الوجهة من تليجرام — تأكد أن المعرّف صحيح وأن البوت يعرف هذه المحادثة',
    }
  }

  const member = await botApi(botToken, 'getChatMember', {
    chat_id: chatId,
    user_id: me.result.id,
  })
  if (!member.ok || !member.result) {
    return {
      ok: false,
      error:
        member.description === 'NETWORK_ERROR'
          ? 'تعذّر الوصول إلى تليجرام — تحقق من الشبكة ثم أعد الفحص'
          : 'تعذّر قراءة عضوية البوت — أضف البوت إلى الوجهة أولاً',
      chat: {
        id: chat.result.id,
        type: String(chat.result.type ?? 'unknown'),
        title: chat.result.title,
        username: chat.result.username,
      },
    }
  }

  const status = String(member.result.status ?? 'unknown')
  const canPost =
    status === 'creator' ||
    status === 'administrator' ||
    status === 'member' ||
    (status === 'restricted' && member.result.can_send_messages === true)

  if (!canPost) {
    const why =
      status === 'kicked'
        ? 'البوت مطرود من الوجهة — أعده مشرفاً ثم أعد الفحص'
        : status === 'left'
          ? 'البوت غادر الوجهة — أعده إليها ثم أعد الفحص'
          : 'البوت بلا صلاحية نشر — امنحه صلاحية الإرسال ثم أعد الفحص'
    return {
      ok: false,
      error: why,
      memberStatus: status,
      canPost: false,
      chat: {
        id: chat.result.id,
        type: String(chat.result.type ?? 'unknown'),
        title: chat.result.title,
        username: chat.result.username,
      },
    }
  }

  return {
    ok: true,
    memberStatus: status,
    canPost: true,
    chat: {
      id: chat.result.id,
      type: String(chat.result.type ?? 'unknown'),
      title: chat.result.title,
      username: chat.result.username,
    },
  }
}
