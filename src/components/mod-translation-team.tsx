'use client'

import { Globe, Mail, Users } from 'lucide-react'
import { SiDiscord, SiTelegram, SiX, SiYoutube } from 'react-icons/si'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import type { ModContactLink, ModTeamMember } from '@/lib/types'

interface ModTranslationTeamProps {
  teamMembers: ModTeamMember[]
  contactLinks: ModContactLink[]
  /** التحكم يدوياً بعدد الأعمدة (إذا لم يُحدد، يُحسب تلقائياً) */
  columns?: number
  /** التحكم في المسافة بين الكروت */
  gap?: 'sm' | 'md' | 'lg'
}

const CONTACT_ICONS: Record<string, React.ReactNode> = {
  mail: <Mail className="h-4 w-4" />,
  website: <Globe className="h-4 w-4" />,
  telegram: <SiTelegram className="h-4 w-4" />,
  twitter: <SiX className="h-4 w-4" />,
  youtube: <SiYoutube className="h-4 w-4" />,
  discord: <SiDiscord className="h-4 w-4" />,
}

const CONTACT_COLORS: Record<string, string> = {
  mail: '#6b7280',
  website: '#3b82f6',
  telegram: '#229ED9',
  twitter: '#1DA1F2',
  youtube: '#FF0000',
  discord: '#5865F2',
}

const ROLE_BADGES: Record<number, string> = {
  0: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  1: 'bg-primary/15 text-primary border-primary/30',
  2: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

export function ModTranslationTeam({
  teamMembers,
  contactLinks,
  columns,
  gap = 'md',
}: ModTranslationTeamProps) {
  const count = teamMembers.length
  const autoCols = count <= 3 ? 1 : count <= 6 ? 2 : count <= 12 ? 3 : 4
  const desktopCols = columns || autoCols
  const mobileCols = count > 12 ? 2 : 1
  const gapClass = gap === 'sm' ? 'gap-1.5' : gap === 'lg' ? 'gap-3' : 'gap-2'

  return (
    <div className="space-y-4">
      {/* ===== فريق التعريب ===== */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-foreground">فريق التعريب</h3>
          <span className="text-[11px] font-bold text-foreground">({teamMembers.length})</span>
        </div>

        {teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">لا يوجد معلومات عن فريق التعريب.</p>
        ) : (
          <div
            className={`grid ${gapClass} team-grid`}
            style={
              {
                '--team-mobile-cols': mobileCols,
                '--team-desktop-cols': desktopCols,
              } as React.CSSProperties
            }
          >
            <style>{`
              .team-grid { grid-template-columns: repeat(var(--team-mobile-cols), minmax(0, 1fr)); }
              @media (min-width: 640px) { .team-grid { grid-template-columns: repeat(var(--team-desktop-cols), minmax(0, 1fr)); } }
            `}</style>
            {teamMembers.map((member, i) => (
              <div
                key={member.id}
                className="group relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-3 transition-all duration-200 hover:border-border/70 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0 border-2 border-border/60 shadow-sm transition-colors group-hover:border-primary/40">
                    <AvatarImage src={member.avatarUrl || undefined} alt={member.name} />
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                      {member.name[0]}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{member.name}</span>
                      {i < 3 && (
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none ${ROLE_BADGES[i] || ROLE_BADGES[2]}`}
                        >
                          {i === 0 ? 'قائد' : i === 1 ? 'رئيسي' : 'عضو'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] font-bold text-foreground/80">{member.role}</p>
                    {member.contribution && (
                      <p className="mt-1 line-clamp-1 text-[10px] font-medium text-foreground/60">
                        {member.contribution}
                      </p>
                    )}
                  </div>
                </div>

                {/* زاوية مزخرفة */}
                {i === 0 && (
                  <div className="absolute -start-4 -top-4 h-12 w-12 rotate-45 bg-gradient-to-br from-amber-500/20 to-transparent" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== التواصل ===== */}
      {contactLinks.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">التواصل</h3>
            <span className="text-[11px] font-bold text-foreground">({contactLinks.length})</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {contactLinks.map((contact) => {
              const color = CONTACT_COLORS[contact.type] || '#4b5563'
              return (
                <a
                  key={contact.id}
                  href={contact.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-border/40 bg-gradient-to-l from-card/60 to-card/30 px-3 py-2.5 transition-all duration-200 hover:border-border/60 hover:shadow-md"
                >
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: color }}
                  >
                    {CONTACT_ICONS[contact.type] || <Globe className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-foreground">{contact.label}</div>
                    <div className="truncate text-[10px] font-medium text-foreground/70">
                      {contact.url.replace(/^https?:\/\//, '').replace(/^mailto:/, '')}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
