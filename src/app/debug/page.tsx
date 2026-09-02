'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

function collect() {
  const docEl = document.documentElement;
  const rootFontSize = parseFloat(getComputedStyle(docEl).fontSize);
  const bodyFontSize = parseFloat(getComputedStyle(document.body).fontSize);
  const scrollbarWidth = window.innerWidth - docEl.clientWidth;
  const scale = window.visualViewport ? Number(window.visualViewport.scale.toFixed(2)) : 1;

  const loginLink = document.querySelector('header a[href="/login"]');
  const loginRect = loginLink?.getBoundingClientRect();
  const loginVisible = loginRect
    ? loginRect.width > 0 && loginRect.right <= window.innerWidth && loginRect.left >= 0
    : null;

  const card = document.querySelector('article');
  const cardRect = card?.getBoundingClientRect();
  const title = card?.querySelector('h3');
  const titleRect = title?.getBoundingClientRect();

  return {
    المتصفح: navigator.userAgent,
    الviewport: `${window.innerWidth}×${window.innerHeight}`,
    الclientWidth: docEl.clientWidth,
    عرض_الscrollbar: scrollbarWidth,
    devicePixelRatio: window.devicePixelRatio,
    الزوم_الفعلي: scale,
    حجم_الخط_الاساسي_root: rootFontSize,
    حجم_خط_الbody: bodyFontSize,
    خط_Cairo_محمل: document.fonts ? document.fonts.check('16px Cairo') : null,
    overflow_افقي: docEl.scrollWidth > docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    تسجيل_الدخول_ظاهر: loginVisible,
    موضع_زر_الدخول: loginRect ? `${Math.round(loginRect.left)}→${Math.round(loginRect.right)}` : null,
    مقاس_البطاقة: cardRect ? `${Math.round(cardRect.width)}×${Math.round(cardRect.height)}` : null,
    ارتفاع_العنوان: titleRect ? Math.round(titleRect.height) : null,
    حجم_خط_العنوان: title ? getComputedStyle(title).fontSize : null,
    الوقت: new Date().toLocaleString('ar-EG'),
  };
}

export default function DebugPage() {
  const [info, setInfo] = useState<Record<string, any> | null>(null);

  const refresh = useCallback(() => setInfo(collect()), []);

  useEffect(() => {
    refresh();
    window.addEventListener('resize', refresh);
    return () => window.removeEventListener('resize', refresh);
  }, [refresh]);

  const copy = async () => {
    if (!info) return;
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    alert('تم نسخ التقرير ✅');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6" dir="rtl">
      <h1 className="text-2xl font-bold">🔬 صفحة التشخيص</h1>
      <p className="text-sm text-muted-foreground">
        افتح الصفحة دي في المتصفحين وقارن القيم، أو اضغط نسخ وابعت التقريرين.
      </p>

      <div className="flex gap-2">
        <Button onClick={refresh}>🔄 تحديث</Button>
        <Button onClick={copy} variant="outline">📋 نسخ التقرير</Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <tbody>
            {info &&
              Object.entries(info).map(([key, value]) => (
                <tr key={key} className="border-b last:border-0 odd:bg-muted/30">
                  <td className="p-2 font-bold whitespace-nowrap">{key}</td>
                  <td className="p-2 break-all" dir="ltr">{String(value)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
