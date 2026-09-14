/**
 * Mod Form Documentation — Complete field reference for mod creators and moderators.
 *
 * This file contains ALL documentation content structured for rendering.
 * Each section has: id, title, icon, content (array of blocks).
 *
 * Block types:
 *   'text'    — plain paragraph
 *   'list'    — unordered list
 *   'example' — highlighted example box
 *   'tip'     — helpful suggestion
 *   'warn'    — warning / common mistake
 *   'field'   — field documentation (label, description, options, examples)
 *   'sub'     — sub-heading
 */

export interface DocBlock {
  type: 'text' | 'list' | 'example' | 'tip' | 'warn' | 'field' | 'sub'
  label?: string
  text?: string
  items?: string[]
  value?: string
  options?: { label: string; desc: string }[]
}

export interface DocSection {
  id: string
  title: string
  icon?: string
  children: DocBlock[]
}

export interface DocPage {
  id: string
  title: string
  icon?: string
  intro?: string
  sections: DocSection[]
}

// ═══════════════════════════════════════════════════════════════
//  Page 1: Introduction
// ═══════════════════════════════════════════════════════════════

const intro: DocPage = {
  id: 'intro',
  title: 'المقدمة',
  icon: '📖',
  intro: 'مرحباً بك في دليل حقول التعريب!',
  sections: [
    {
      id: 'what',
      title: 'ما هو هذا الدليل؟',
      children: [
        {
          type: 'text',
          text: 'هذا الدليل يشرح كل حقل في نموذج إضافة التعريب (Mod Form). سواء كنت منشئ محتوى تريد نشر تعريب جديد، أو مشرف تريد مراجعة التعريبات — هذا الدليلprintStats لك كل ما تحتاج معرفته.',
        },
        {
          type: 'text',
          text: 'المنصة تدعم 9 منصات ألعاب مختلفة، وكل منصة لها حقول خاصة بها. هذا الدليل يوضح:',
        },
        {
          type: 'list',
          items: [
            'الحقول العامة التي تظهر في كل المنصات',
            'الحقول الخاصة بكل منصة (بلايستيشن، اكس بوكس، سويتش، أندرويد)',
            'كيفية ملء كل حقل بشكل صحيح',
            'أمثلة عملية لكل حقل',
            'نصائح للمشرفين عند المراجعة',
          ],
        },
      ],
    },
    {
      id: 'how-creators',
      title: 'كيف تستخدم هذا الدليل (لمنشئي المحتوى)',
      children: [
        {
          type: 'text',
          text: 'عند إضافة تعريب جديد، ستجد حقولاً مختلفة في النموذج. اتبع الخطوات التالية:',
        },
        {
          type: 'list',
          items: [
            'اختر المنصة التي تعمل عليها أولاً',
            'املأ الحقول العامة (الاسم، الوصف، طريقة التعريب)',
            'املأ الحقول الخاصة بالمنصة (معرّف اللعبة، رقم الإصدار، إلخ)',
            'راجع الأمثلة والنصائح لكل حقل',
            'تأكد من أن جميع المعلومات دقيقة قبل الحفظ',
          ],
        },
      ],
    },
    {
      id: 'how-moderators',
      title: 'كيف تستخدم هذا الدليل (للمشرفين)',
      children: [
        {
          type: 'text',
          text: 'عند مراجعة تعريب جديد، استخدم هذا الدليل للتحقق من:',
        },
        {
          type: 'list',
          items: [
            'دقة المعلومات المدخلة',
            'توافق معرّف اللعبة مع المنصة المختارة',
            'صيغة الأرقام والمعرفات',
            'مطابقة طريقة التعريب للجودة الفعلية',
            'اكتمال جميع الحقول المطلوبة',
          ],
        },
      ],
    },
    {
      id: 'platforms',
      title: 'المنصات المدعومة',
      children: [
        {
          type: 'text',
          text: 'المنصة تدعم 9 منصات ألعاب:',
        },
        {
          type: 'list',
          items: [
            'PC (بي سي)',
            'PlayStation 1 (بلايستيشن 1)',
            'PlayStation 2 (بلايستيشن 2)',
            'PlayStation 3 (بلايستيشن 3)',
            'PlayStation 4 (بلايستيشن 4)',
            'PlayStation 5 (بلايستيشن 5)',
            'Nintendo Switch (نينتندو سويتش)',
            'Xbox 360 (إكس بوكس 360)',
            'Android (أندرويد)',
          ],
        },
      ],
    },
  ],
}

// ═══════════════════════════════════════════════════════════════
//  Page 2: Common Fields
// ═══════════════════════════════════════════════════════════════

const commonFields: DocPage = {
  id: 'common',
  title: 'الحقول العامة',
  icon: '📝',
  intro: 'هذه الحقول تظهر في جميع المنصات. املأها دائماً بغض النظر عن المنصة التي تعمل عليها.',
  sections: [
    {
      id: 'modName',
      title: 'اسم التعريب (Mod Name)',
      children: [
        {
          type: 'field',
          label: 'اسم التعريب *',
          text: 'الاسم الرئيسي للتعريب الذي يظهر للمستخدمين. يجب أن يكون واضحاً ومميزاً.',
        },
        {
          type: 'sub',
          label: 'ماذا تكتب؟',
          text: 'اسم واضح ووصفي يتضمن اسم اللعبة. تجنب الأسماء الغامضة أو القصيرة جداً.',
        },
        {
          type: 'example',
          text: '✅ تعريب لعبة Hollow Knight: Silksong\n✅ تعريب GTA V — الترجمة العربية الكاملة\n❌ تعريب 1\n❌ mod جديد',
        },
        {
          type: 'tip',
          text: 'اجعل الاسم قصيراً لكن وصفياً. يفضل أن يتضمن اسم اللعبة + وصف مختصر للتعريب.',
        },
        {
          type: 'warn',
          text: 'لا تستخدم أسماء مكررة. تحقق من التعريبات الموجودة أولاً.',
        },
      ],
    },
    {
      id: 'arabicName',
      title: 'الاسم بالعربي (Arabic Name)',
      children: [
        {
          type: 'field',
          label: 'الاسم بالعربي',
          text: 'الترجمة العربية لاسم اللعبة أو التعريب. يُستخدم للبحث والعرض بالعربية.',
        },
        {
          type: 'sub',
          label: 'ماذا تكتب؟',
          text: 'الاسم العربي الشائع للعبة. استخدم الترجمة الرسمية إن وجدت، أو الشائعة بين اللاعبين العرب.',
        },
        {
          type: 'example',
          text: '✅ فارس الفراغ: أغنية الحرير (Hollow Knight: Silksong)\n✅ عصابات لوس سانتوس (GTA V)\n❌ هولو نايت: سيلكسونغ (ترجمة حرفية)',
        },
        {
          type: 'tip',
          text: 'ابحث عن الاسم العربي الأكثر شيوعاً بين اللاعبين. الاسم المعروف أفضل من الترجمة الحرفية.',
        },
      ],
    },
    {
      id: 'translationMethod',
      title: 'طريقة التعريب (Localization Method)',
      children: [
        {
          type: 'field',
          label: 'طريقة التعريب',
          text: 'الطريقة المستخدمة في إنشاء الترجمة.اختر أحد الخيارات الثلاثة أدناه.',
        },
        {
          type: 'sub',
          label: 'الخيارات المتاحة:',
          options: [
            { label: 'بشري (Human)', desc: 'الترجمة_DONE полностью بواسطة مترجمين بشر. أعلى جودة. يجب ذكر هوية المترجمين وعدد الأشخاص.' },
            { label: 'آلي (AI/Automated)', desc: 'الترجمة_DONE بواسطة أدوات ذكاء اصطناعي. يجب تحديد الأداة المستخدمة: محرك ترجمة تقليدي (مثل Google Translate)، نموذج لغوي كبير (مثل ChatGPT)، أو أداة متخصصة (مثل DeepL). يجب ذكر ما إذا تمت مراجعة الترجمة بشرياً.' },
            { label: 'مختلط (Hybrid)', desc: 'مزيج من الترجمة الآلية والبشرية. يجب تحديد أي جزء كان آلياً وأي جزء كان بشرياً، ومَن قام بالمراجعة.' },
          ],
        },
        {
          type: 'example',
          text: '✅ بشري — ترجمةDone by Ahmed and Sara\n✅ مختلط — استخدمنا ChatGPT للترجمة الأولية، ثم مراجعة وتنقيح by 3 مترجمين\n❌ آلي (بدون تفاصيل)',
        },
        {
          type: 'warn',
          text: 'كن صادقاً عن الطريقة. المستخدمون يقدرون الشفافية. الترجمة الآلي بدون مراجعة بشري Tb坦言 repository.',
        },
      ],
    },
    {
      id: 'translationType',
      title: 'نوع التعريب (Localization Type)',
      children: [
        {
          type: 'field',
          label: 'نوع التعريب',
          text: 'شكل التعريب — هل هو ترجمة نصية فقط، أم يشمل دبلجة صوتية أيضاً؟',
        },
        {
          type: 'sub',
          label: 'الخيارات المتاحة:',
          options: [
            { label: 'نصي (Text)', desc: 'ترجمة النصوص فقط (القوائم، الحوارات، الأوصاف). بدون تغيير الصوت.' },
            { label: 'صوتي (Audio/Voice)', desc: 'دبلجة صوتية — ممثلون عرب يستبدلون الأصوات الأصلية.' },
            { label: 'الاتنين (Both)', desc: 'ترجمة نصية + دبلجة صوتية.' },
          ],
        },
        {
          type: 'example',
          text: '✅ نصي — ترجمة كاملة للقوائم والحوارات بدون دبلجة\n✅ صوتي — دبلجة عربية كاملة لجميع الشخصيات\n❌ نصي (إذا كان يحتوي دبلجة)',
        },
      ],
    },
    {
      id: 'translationScope',
      title: 'محتوى التعريب (Localization Content)',
      children: [
        {
          type: 'field',
          label: 'محتوى التعريب',
          text: 'ما هي الأجزاء المترجمة بالضبط في اللعبة. كن محدداً قدر الإمكان.',
        },
        {
          type: 'sub',
          label: 'عناصر شائعة:',
          items: [
            'القوائم (Menus)',
            'الحوارات (Dialogues)',
            'الأسلحة (Weapons)',
            'التعليمات (Instructions)',
            'الأوصاف (Descriptions)',
            'مقاطع الفيديو (Cutscenes)',
            'القائمة الرئيسية (Main Menu)',
            'الإعدادات (Settings)',
            'أسماء الشخصيات (Character Names)',
            'أسماء الأماكن (Place Names)',
          ],
        },
        {
          type: 'example',
          text: '✅ شاملة (حوارات، قوائم، واجهة) — تعريب كامل\n✅ نصوص فقط (قوائم + حوارات) — بدون أسماء أماكن\n❌ تعريب كامل (بدون تفاصيل)',
        },
        {
          type: 'tip',
          text: 'إذا كان شيئاً معيناً لم يتم ترجمته، اذكره بوضوح. المستخدمون يفضلون المعرفة مسبقاً.',
        },
      ],
    },
    {
      id: 'releaseDate',
      title: 'تاريخ إصدار التعريب (Release Date)',
      children: [
        {
          type: 'field',
          label: 'تاريخ إصدار التعريب',
          text: 'التاريخ الذي تم فيه إصدار التعريب. يتم تحديده تلقائياً عند النشر.',
        },
        {
          type: 'example',
          text: '15/09/2025',
        },
        {
          type: 'tip',
          text: 'استخدم تاريخ الإصدار الفعلي وليس تاريخ الإنشاء.',
        },
      ],
    },
    {
      id: 'fileSize',
      title: 'حجم التعريب (Localization Size)',
      children: [
        {
          type: 'field',
          label: 'حجم التعريب',
          text: 'حجم ملف التعريب. يُستخدم لتخزين المستخدمين عن حجم التحميل.',
        },
        {
          type: 'example',
          text: '✅ 13 MB\n✅ 1.5 GB\n❌ 13.247 MB (دقة زائدة)',
        },
        {
          type: 'tip',
          text: 'قرب الحجم لأقرب رقم معقول. لا حاجة للدقة المطلقة.',
        },
      ],
    },
  ],
}

// ═══════════════════════════════════════════════════════════════
//  Page 3: Platform-Specific Fields
// ═══════════════════════════════════════════════════════════════

const platformFields: DocPage = {
  id: 'platforms',
  title: 'الحقول الخاصة بالمنصات',
  icon: '🎮',
  intro: 'كل منصة لها حقول خاصة بها除此之外 عن الحقول العامة. اختر منصتك لرؤية الحقول المطلوبة.',
  sections: [
    // ── PC ──
    {
      id: 'pc',
      title: 'PC (بي سي)',
      icon: '💻',
      children: [
        {
          type: 'text',
          text: 'لا توجد حقول إضافية خاصة بـ PC. فقط الحقول العامة المذكورة في الصفحة السابقة.',
        },
        {
          type: 'tip',
          text: 'تأكد من ذكر توافق التعريب مع إصدارات اللعبة المختلفة في حقل "محتوى التعريب".',
        },
      ],
    },

    // ── PS1 / PS2 ──
    {
      id: 'ps1-ps2',
      title: 'PlayStation 1 & PlayStation 2',
      icon: '🎮',
      children: [
        {
          type: 'field',
          label: 'معرّف اللعبة (Game ID)',
          text: 'الرقم التسلسلي الفريد للعبة. يُستخدم للتأكد من توافق التعريب مع الإصدار الصحيح من اللعبة.',
        },
        {
          type: 'sub',
          label: 'صيغة المعرّف:',
          items: [
            'PS1: SCUS-XXXXX (أمريكي) / SLES-XXXXX (أوربي) / SCPS-XXXXX (ياباني)',
            'PS2: SLUS-XXXXX (أمريكي) / SLES-XXXXX (أوربي) / SLPS-XXXXX (ياباني)',
          ],
        },
        {
          type: 'example',
          text: '✅ SLES-54321 (النسخة الأوروبية)\n✅ SCUS-94426 (النسخة الأمريكية)\n❌ 54321 (بدون بادئة المنطقة)',
        },
        {
          type: 'tip',
          text: 'أضف اسم المنطقة (أمريكي/أوربي/ياباني) لتجنب اللبس.',
        },
      ],
    },

    // ── PS3 ──
    {
      id: 'ps3',
      title: 'PlayStation 3',
      icon: '🎮',
      children: [
        {
          type: 'field',
          label: 'معرّف اللعبة (Game ID)',
          text: 'الرقم التسلسلي للعبة على PS3.',
        },
        {
          type: 'sub',
          label: 'صيغة المعرّف:',
          text: 'BLUS-XXXXX (أمريكي) / BLES-XXXXX (أوربي) / BLJM-XXXXX (ياباني)',
        },
        {
          type: 'example',
          text: '✅ BLUS-30118 (النسخة الأمريكية)',
        },
        {
          type: 'field',
          label: 'رقم تحديث اللعبة المتوافق',
          text: 'إصدار التحديث الذي يتوافق معه التعريب. التعريبات غالباً مرتبطة بإصدار معين من اللعبة.',
        },
        {
          type: 'example',
          text: '✅ متوافق مع التحديث 1.05\n✅ متوافق مع التحديثات 1.01 حتى 1.05',
        },
      ],
    },

    // ── PS4 ──
    {
      id: 'ps4',
      title: 'PlayStation 4',
      icon: '🎮',
      children: [
        {
          type: 'field',
          label: 'معرّف اللعبة (CUSA)',
          text: 'المعرّف الفريد للعبة على PS4. يبدأ بـ CUSA- متبوعاً بأرقام.',
        },
        {
          type: 'example',
          text: '✅ CUSA-00123\n❌ 00123 (بدون CUSA-)',
        },
        {
          type: 'tip',
          text: 'يوجد CUSA ID عادةً في بنية ملفات اللعبة.',
        },
        {
          type: 'field',
          label: 'تحديث النظام المتوافق',
          text: '最低 إصدار نظام PS4 المطلوب لتشغيل التعريب.',
        },
        {
          type: 'example',
          text: '✅ يتطلب نظام 9.00 أو أحدث',
        },
        {
          type: 'field',
          label: 'رقم تحديث اللعبة المتوافق',
          text: 'إصدار تحديث اللعبة الذي يتوافق معه التعريب.',
        },
        {
          type: 'example',
          text: '✅ متوافق مع التحديث 1.02',
        },
      ],
    },

    // ── PS5 ──
    {
      id: 'ps5',
      title: 'PlayStation 5',
      icon: '🎮',
      children: [
        {
          type: 'field',
          label: 'معرّف اللعبة (PPSA)',
          text: 'المعرّف الفريد للعبة على PS5. يبدأ بـ PPSA- أو ELUS-.',
        },
        {
          type: 'example',
          text: '✅ PPSA-00001',
        },
        {
          type: 'field',
          label: 'تحديث النظام المتوافق',
          text: '最低 إصدار نظام PS5 المطلوب.',
        },
        {
          type: 'example',
          text: '✅ يتطلب نظام 11.00 أو أحدث',
        },
        {
          type: 'field',
          label: 'رقم تحديث اللعبة المتوافق',
          text: 'إصدار تحديث اللعبة الذي يتوافق معه التعريب.',
        },
        {
          type: 'example',
          text: '✅ متوافق مع التحديث 1.02',
        },
      ],
    },

    // ── Switch ──
    {
      id: 'ns',
      title: 'Nintendo Switch (نينتندو سويتش)',
      icon: '🎮',
      children: [
        {
          type: 'field',
          label: 'اصدار اللعبه (Title ID)',
          text: 'المعرّف الفريد للعبة على Switch. يتكون من 16 حرف سداسي عشري.',
        },
        {
          type: 'example',
          text: '✅ 010042D00D900000\n❌ 010042D00D9 (قصيرة)',
        },
        {
          type: 'warn',
          text: 'Title ID أمر بالغ الأهمة لتعريب Switch. تحقق منه مرتين.',
        },
        {
          type: 'field',
          label: 'الجهاز',
          text: 'نموذج جهاز Switch الذي يتوافق معه التعريب.',
        },
        {
          type: 'example',
          text: '✅ Nintendo Switch (NS1)\n✅ جميع أجهزة نينتندو سويتش',
        },
        {
          type: 'field',
          label: 'رقم التحديث المتوافق',
          text: 'إصدار تحديث اللعبة الذي يتوافق معه التعريب.',
        },
        {
          type: 'example',
          text: '✅ متوافق مع التحديث 1.0.28716',
        },
      ],
    },

    // ── Xbox 360 ──
    {
      id: 'xbox360',
      title: 'Xbox 360 (إكس بوكس 360)',
      icon: '🎮',
      children: [
        {
          type: 'field',
          label: 'معرّف اللعبة (Title ID)',
          text: 'المعرّف الفريد للعبة. يتكون من 8 أحرف سداسية عشريّة.',
        },
        {
          type: 'example',
          text: '✅ 545407E7',
        },
        {
          type: 'field',
          label: 'معرّف الوسائط (Media ID)',
          text: 'معرّف قرص/وسائط اللعبة. مطلوب لطرق تثبيت معينة.',
        },
        {
          type: 'example',
          text: '✅ D5A3-48F2-B1C7-9E04',
        },
        {
          type: 'field',
          label: 'صيغة اللعبة المدعومة',
          text: 'صيغة ملف اللعبة. كل صيغة مرتبطة بنوع تعديل الجهاز.',
        },
        {
          type: 'sub',
          label: 'الصيغ المتاحة:',
          options: [
            { label: 'GOD (Games on Demand)', desc: 'الصيغة الرقمية. الأسهل في التثبيت.' },
            { label: 'JTAG', desc: 'لأجهزة JTAG المعدلة.' },
            { label: 'RGH (Reset Glitch Hack)', desc: 'لأجهزة RGH المعدلة.' },
            { label: 'ISO', desc: 'صورة قرص. مأخوذة من القرص الأصلي.' },
            { label: 'XEX', desc: 'صيغة تنفيذية. للتعديلات المتقدمة.' },
          ],
        },
        {
          type: 'field',
          label: 'التوافق (Compatibility)',
          text: 'معلومات التوافق الإضافية — نوع الجهاز وإصدار الداش بورد.',
        },
        {
          type: 'example',
          text: '✅ متوافق مع أجهزة RGH على داش بورد 17559',
        },
      ],
    },

    // ── Android ──
    {
      id: 'android',
      title: 'Android (أندرويد)',
      icon: '📱',
      children: [
        {
          type: 'field',
          label: 'نوع ملف التثبيت',
          text: 'نوع ملفات التثبيت المستخدمة. كل لعبة لها طريقة تثبيت مختلفة.',
        },
        {
          type: 'sub',
          label: 'الأنواع المتاحة:',
          options: [
            { label: 'APK مدمج (Integrated APK)', desc: 'كل شيء في ملف APK واحد. أسهل طريقة للتثبيت. المستخدم يثبّت الملف مباشرة.' },
            { label: 'ملفات OBB (OBB Files)', desc: 'APK + ملفات بيانات OBB منفصلة. المستخدم يثبّت APK ثم ينسخ ملفات OBB للمجلد المحدد. شائعة للألعاب الكبيرة.' },
            { label: 'مجلد Data (Data Folder)', desc: 'يتطلب نسخ مجلد بيانات يدوياً. تعقيد أكثر. شائعة في بعض محركات الألعاب.' },
          ],
        },
        {
          type: 'example',
          text: '✅ APK مدمج — ملف واحد فقط، قم بتثبيته مباشرة',
        },
        {
          type: 'field',
          label: 'بنية المعالج المتوافقة',
          text: 'بنية المعالج التي يدعمها التعريب. الأجهزة مختلفة في المعالجات.',
        },
        {
          type: 'sub',
          label: 'البنى المتاحة:',
          options: [
            { label: 'ARM64 (64-bit ARM)', desc: 'الأجهزة الحديثة (معظم الهواتف بعد 2015). الأكثر شيوعاً اليوم. الخيار الآمن إذا لم تكن متأكداً.' },
            { label: 'ARMv7 (32-bit ARM)', desc: 'الأجهزة القديمة (قبل 2015). بعض الأجهزة الرخيصة لا تزال تستخدمها.' },
            { label: 'x86', desc: 'للمحاكيات على الكمبيوتر. نادر على الأجهزة الفعلية.' },
          ],
        },
        {
          type: 'example',
          text: '✅ ARM64 — متوافق مع معظم الأجهزة الحديثة (بعد 2015)',
        },
        {
          type: 'field',
          label: 'رقم إصدار اللعبة المتوافق',
          text: 'إصدار اللعبة الذي يتوافق معه التعريب.',
        },
        {
          type: 'example',
          text: '✅ متوافق مع الإصدار 2.5.1\n✅ متوافق مع الإصدارات 2.0 حتى 2.5',
        },
        {
          type: 'field',
          label: 'الحد الأدنى لنظام الأندرويد',
          text: '最低 إصدار Android المطلوب لتشغيل التعريب.',
        },
        {
          type: 'example',
          text: '✅ يتطلب أندرويد 8.0 أو أحدث',
        },
      ],
    },
  ],
}

// ═══════════════════════════════════════════════════════════════
//  Page 4: Moderator Guidelines
// ═══════════════════════════════════════════════════════════════

const moderatorGuide: DocPage = {
  id: 'moderator',
  title: 'معايير المشرفين',
  icon: '✅',
  intro: 'دليل شامل للمشرفين عند مراجعة التعريبات. استخدم هذه المعايير للقرار عند القبول أو الرفض.',
  sections: [
    {
      id: 'accept',
      title: 'ما يجب قبوله',
      children: [
        {
          type: 'list',
          items: [
            'معلومات الحقول كاملة ودقيقة',
            'اسم التعريب واضح ومميز',
            'حقول المنصة صحيحة (معرّف اللعبة متوافق مع المنصة)',
            'طريقة التعريب صادقة ومطابقة للجودة الفعلية',
            'حجم الملف معقول ومطابق للمحتوى',
            'تاريخ الإصدار معقول',
            'لا توجد عناوين مكررة',
            'المحتوى مناسب (لا يوجد محتوى مخالف)',
          ],
        },
      ],
    },
    {
      id: 'reject',
      title: 'ما يجب رفضه',
      children: [
        {
          type: 'list',
          items: [
            'حقول مطلوبة فارغة أو ناقصة',
            'طريقة تعريب مضللة (مثلاً: يدعي أنه بشري وهو آلي)',
            'معرّف لعبة غير صحيح للمنصة المختارة',
            'حجم ملف مشبوه (صغير جداً للمحتوى المذكور)',
            'تعريبات مكررة (مسبقاً موجودة)',
            'محتوى مخالف أو غير مناسب',
            'حقول منصة خاطئة (مثلاً: CUSA ID في حقل PS5)',
          ],
        },
      ],
    },
    {
      id: 'quality',
      title: 'معايير الجودة',
      children: [
        {
          type: 'text',
          text: 'عند مراجعة جودة الترجمة نفسها (وليس الحقول):',
        },
        {
          type: 'list',
          items: [
            'الترجمة مفهومة وطبيعية بالعربية',
            'لا توجد آثار ترجمة آلية واضحة (جمل غير مفهومة)',
            'الإملاء والقواعد النحوية صحيحة',
            'التوافق في المصطلحات (نفس المصطلح لنفس الشيء)',
            'الملاءمة الثقافية (عدم استخدام تعبيرات غير مناسبة)',
            'إذا كانت آلي: تمت المراجعة البشرية والتنقيح',
          ],
        },
      ],
    },
    {
      id: 'field-check',
      title: 'الفحص الميداني للحقول',
      children: [
        {
          type: 'sub',
          label: 'PS4: تحقق من CUSA ID',
          text: 'تأكد أن CUSA ID يبدأ بـ CUSA- ويحتوي أرقاماً فقط بعده.',
        },
        {
          type: 'sub',
          label: 'PS5: تحقق من PPSA ID',
          text: 'تأكد أن PPSA ID يبدأ بـ PPSA- أو ELUS-.',
        },
        {
          type: 'sub',
          label: 'Switch: تحقق من Title ID',
          text: 'تأكد أن Title ID يحتوي 16 حرف سداسي عشري (0-9, A-F).',
        },
        {
          type: 'sub',
          label: 'Xbox 360: تحقق من الصيغة',
          text: 'تأكد أن الصيغة المختارة (GOD/JTAG/RGH/ISO/XEX) تتوافق مع نوع الجهاز المذكور.',
        },
        {
          type: 'sub',
          label: 'Android: تحقق من بنية المعالج',
          text: 'تأكد أن بنية المعالج متوافقة مع نوع الجهاز المستهدف.',
        },
      ],
    },
  ],
}

// ═══════════════════════════════════════════════════════════════
//  Export
// ═══════════════════════════════════════════════════════════════

export const ALL_DOCS: DocPage[] = [intro, commonFields, platformFields, moderatorGuide]

export function getDocPage(id: string): DocPage | undefined {
  return ALL_DOCS.find((p) => p.id === id)
}
