'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Send, Bot, Gamepad2, Smartphone, Monitor } from 'lucide-react'

interface SocialLinks {
  telegram?: string
  discord?: string
  youtube?: string
  twitter?: string
}

export function Footer() {
  const [siteName, setSiteName] = useState('GAMES ARABIC')
  const [social, setSocial] = useState<SocialLinks>({})

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(({ settings }) => {
      if (settings.site_name) setSiteName(settings.site_name)
      setSocial({
        telegram: settings.telegram || '',
        discord: settings.discord || '',
        youtube: settings.youtube || '',
        twitter: settings.twitter || '',
      })
    }).catch(() => {})
  }, [])

  const nameParts = siteName.split(' ')

  return (
    <footer className="mt-auto border-t border-border bg-card/30" dir="rtl">
      <div className="mx-auto max-w-[1200px] px-4 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-1">
              <span className="text-lg font-extrabold tracking-tight">
                <span className="text-gradient">{nameParts[0] || 'GAMES'}</span>
                <span className="text-foreground"> {nameParts.slice(1).join(' ') || 'ARABIC'}</span>
              </span>
            </Link>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
              تعريب وأرشفة الألعاب العربية لكل المنصات
            </p>

            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {social.telegram && (
                  <SocialIcon href={social.telegram} label="جروب المجتمع">
                    <Send className="h-4 w-4" />
                  </SocialIcon>
                )}
                <SocialIcon href="https://t.me/PS_AR_PC" label="تعريبات PlayStation">
                  <Gamepad2 className="h-4 w-4" />
                </SocialIcon>
                <SocialIcon href="https://t.me/PS_PC_AR" label="تعريبات PC">
                  <Monitor className="h-4 w-4" />
                </SocialIcon>
                <SocialIcon href="https://t.me/PS_PC_NS" label="تعريبات Nintendo Switch">
                  <Smartphone className="h-4 w-4" />
                </SocialIcon>
                <SocialIcon href="https://t.me/In_Arabic_bot" label="بوت البحث">
                  <Bot className="h-4 w-4" />
                </SocialIcon>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">الأقسام</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <FooterLink href="/?view=platform&platform=PC">ARABIC PC</FooterLink>
              <FooterLink href="/?view=platform&platform=X360">ARABIC XBOX 360</FooterLink>
              <FooterLink href="/?view=platform&platform=NS">ARABIC NS</FooterLink>
              <FooterLink href="/?view=platform&platform=PS4">ARABIC PS4</FooterLink>
              <FooterLink href="/?view=platform&platform=PS3">ARABIC PS3</FooterLink>
              <FooterLink href="/?view=platform&platform=PS2">ARABIC PS2</FooterLink>
              <FooterLink href="/?view=platform&platform=PS1">ARABIC PS1</FooterLink>
            </div>
          </div>

          <FooterCol title="استكشاف">
            <FooterLink href="/?view=series">سلاسل التعريبات</FooterLink>
            <FooterLink href="/?view=support">دعم الأقسام</FooterLink>
            <FooterLink href="/?view=problems">مشاكل وحلول</FooterLink>
          </FooterCol>

          <FooterCol title="المجتمع">
            {social.telegram && (
              <FooterLink href={social.telegram} target="_blank">جروب تليجرام</FooterLink>
            )}
            {social.discord && (
              <FooterLink href={social.discord} target="_blank">سيرفر Discord</FooterLink>
            )}
            {social.youtube && (
              <FooterLink href={social.youtube} target="_blank">قناة YouTube</FooterLink>
            )}
            {social.twitter && (
              <FooterLink href={social.twitter} target="_blank">Twitter / X</FooterLink>
            )}
            <FooterLink href="/?view=about">من نحن</FooterLink>
          </FooterCol>

          <FooterCol title="حول">
            <FooterLink href="/?view=about">من نحن</FooterLink>
            <FooterLink href="/?view=terms">شروط الخدمة</FooterLink>
            <FooterLink href="/?view=privacy">سياسة الخصوصية</FooterLink>
          </FooterCol>
        </div>

        <div className="mt-4 flex items-center justify-center border-t border-border pt-3">
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} {siteName} — صُنع في مصر ❤️
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  )
}

function FooterLink({ href, children, target }: { href: string; children: React.ReactNode; target?: string }) {
  return (
    <li>
      <Link href={href} target={target} className="text-sm text-muted-foreground transition-colors hover:text-primary">
        {children}
      </Link>
    </li>
  )
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      {children}
    </Link>
  )
}
