// ModFormSettings — section 4 (relations), 6 (team + contacts), 8 (custom tabs).
// Presentational only; all state lives in the ModForm orchestrator.

import { LayoutPanelTop, Mail, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Section } from './primitives'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import type {
  ContactLink,
  CustomTab,
  SeriesOpt,
  TeamMember,
  TeamOpt,
} from './primitives'

interface Props {
  seriesId: string
  setSeriesId: (v: string) => void
  seriesList: SeriesOpt[]
  teamId: string
  setTeamId: (v: string) => void
  teamsList: TeamOpt[]
  teamMembers: TeamMember[]
  setTeamMembers: (v: TeamMember[] | ((p: TeamMember[]) => TeamMember[])) => void
  addEmptyMember: () => void
  contactLinks: ContactLink[]
  setContactLinks: (v: ContactLink[] | ((p: ContactLink[]) => ContactLink[])) => void
  addEmptyContact: () => void
  customTabs: CustomTab[]
  setCustomTabs: (v: CustomTab[] | ((p: CustomTab[]) => CustomTab[])) => void
  addEmptyTab: () => void
  slugify: (s: string) => string
}

export function ModFormSettings(p: Props) {
  const { dict } = useStudioLanguage()
  const f = dict.form
  return (
    <>
      {/* ===== 4. relations ===== */}
      <Section title={f.relations}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={f.series} hint={f.seriesHint}>
            <select
              value={p.seriesId}
              onChange={(e) => p.setSeriesId(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">{f.noSeries}</option>
              {p.seriesList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={f.transTeam} hint={f.teamHint}>
            <select
              value={p.teamId}
              onChange={(e) => p.setTeamId(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">{f.noTeam}</option>
              {p.teamsList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* ===== 6. translation team ===== */}
      <Section
        title={f.teamSection}
        icon={<Users className="h-4 w-4" />}
        action={
          <Button
            size="sm"
            className="min-h-[44px]"
            variant="outline"
            onClick={p.addEmptyMember}
          >
            <Plus className="me-1 h-4 w-4" /> {f.addMember}
          </Button>
        }
      >
        {p.teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{f.noMembers}</p>
        ) : (
          <div className="space-y-3">
            {p.teamMembers.map((m, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card/40 p-3 sm:grid-cols-4"
              >
                <Field label={f.memberName}>
                  <Input
                    value={m.name}
                    onChange={(e) =>
                      p.setTeamMembers((prev) =>
                        prev.map((mm, idx) => (idx === i ? { ...mm, name: e.target.value } : mm)),
                      )
                    }
                  />
                </Field>
                <Field label={f.memberRole}>
                  <Input
                    value={m.role}
                    onChange={(e) =>
                      p.setTeamMembers((prev) =>
                        prev.map((mm, idx) => (idx === i ? { ...mm, role: e.target.value } : mm)),
                      )
                    }
                  />
                </Field>
                <Field label={f.avatarUrl}>
                  <Input
                    value={m.avatarUrl}
                    onChange={(e) =>
                      p.setTeamMembers((prev) =>
                        prev.map((mm, idx) =>
                          idx === i ? { ...mm, avatarUrl: e.target.value } : mm,
                        ),
                      )
                    }
                    placeholder="https://..."
                  />
                </Field>
                <Field label={f.contribution}>
                  <Input
                    value={m.contribution}
                    onChange={(e) =>
                      p.setTeamMembers((prev) =>
                        prev.map((mm, idx) =>
                          idx === i ? { ...mm, contribution: e.target.value } : mm,
                        ),
                      )
                    }
                  />
                </Field>
                <div className="sm:col-span-4 flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-400 min-h-[44px] min-w-[44px]"
                    onClick={() => p.setTeamMembers((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`${f.deleteMember}${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* contact links */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Mail className="h-4 w-4" /> {f.contacts}
            </h3>
            <Button
              size="sm"
              className="min-h-[44px]"
              variant="outline"
              onClick={p.addEmptyContact}
            >
              <Plus className="me-1 h-4 w-4" /> {f.addContact}
            </Button>
          </div>
          {p.contactLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{f.noContacts}</p>
          ) : (
            <div className="space-y-2">
              {p.contactLinks.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-card/40 p-3 sm:grid-cols-[120px_1fr_1fr_auto]"
                >
                  <select
                    value={c.type}
                    onChange={(e) =>
                      p.setContactLinks((prev) =>
                        prev.map((cc, idx) => (idx === i ? { ...cc, type: e.target.value } : cc)),
                      )
                    }
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    aria-label={f.linkType}
                  >
                    <option value="mail">{f.linkMail}</option>
                    <option value="website">{f.linkWebsite}</option>
                    <option value="telegram">{f.linkTelegram}</option>
                    <option value="twitter">{f.linkTwitter}</option>
                    <option value="youtube">{f.linkYoutube}</option>
                    <option value="discord">{f.linkDiscord}</option>
                  </select>
                  <Input
                    value={c.label}
                    onChange={(e) =>
                      p.setContactLinks((prev) =>
                        prev.map((cc, idx) => (idx === i ? { ...cc, label: e.target.value } : cc)),
                      )
                    }
                    placeholder={f.labelPlaceholder}
                    aria-label={f.labelAria}
                  />
                  <Input
                    value={c.url}
                    onChange={(e) =>
                      p.setContactLinks((prev) =>
                        prev.map((cc, idx) => (idx === i ? { ...cc, url: e.target.value } : cc)),
                      )
                    }
                    placeholder="https://..."
                    aria-label={f.contactUrlAria}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 text-red-400 min-h-[44px] min-w-[44px]"
                    onClick={() => p.setContactLinks((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`${f.deleteContact}${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ===== 8. custom tabs ===== */}
      <Section
        title={f.customTabs}
        icon={<LayoutPanelTop className="h-4 w-4" />}
        action={
          <Button
            size="sm"
            className="min-h-[44px]"
            variant="outline"
            onClick={p.addEmptyTab}
          >
            <Plus className="me-1 h-4 w-4" /> {f.addTab}
          </Button>
        }
      >
        {p.customTabs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {f.noTabs}
          </p>
        ) : (
          <div className="space-y-3">
            {p.customTabs.map((t, i) => (
              <div key={i} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    value={t.name}
                    onChange={(e) =>
                      p.setCustomTabs((prev) =>
                        prev.map((tt, idx) =>
                          idx === i
                            ? {
                                ...tt,
                                name: e.target.value,
                                slug: tt.slug || p.slugify(e.target.value),
                              }
                            : tt,
                        ),
                      )
                    }
                    placeholder={f.tabNamePh}
                    className="flex-1 font-medium"
                    aria-label={f.tabNameAria}
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={t.visible}
                      onChange={(e) =>
                        p.setCustomTabs((prev) =>
                          prev.map((tt, idx) =>
                            idx === i ? { ...tt, visible: e.target.checked } : tt,
                          ),
                        )
                      }
                    />
                    {f.visible}
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-red-400 min-h-[44px] min-w-[44px]"
                    onClick={() => p.setCustomTabs((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`${f.deleteTab}${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={t.content}
                  onChange={(e) =>
                    p.setCustomTabs((prev) =>
                      prev.map((tt, idx) => (idx === i ? { ...tt, content: e.target.value } : tt)),
                    )
                  }
                  rows={5}
                  placeholder={f.tabContentPh}
                  aria-label={f.tabContentAria}
                />
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
