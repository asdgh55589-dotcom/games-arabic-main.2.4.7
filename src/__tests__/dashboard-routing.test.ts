/**
 * Profile-menu dashboard routing: staff land on /admin, creators on
 * /creator, everyone else gets no dashboard link (stays on profile).
 */
import { dashboardPathForRole } from '@/lib/roles'

describe('dashboardPathForRole', () => {
  it.each(['owner', 'manager', 'admin', 'moderator'])('staff role %s → /admin', (role) => {
    expect(dashboardPathForRole(role)).toBe('/admin')
  })

  it.each(['creator', 'publisher'])('creator role %s → /creator', (role) => {
    expect(dashboardPathForRole(role)).toBe('/creator')
  })

  it.each(['member', '', undefined, null, 'unknown-role'])('role %s → null (profile)', (role) => {
    expect(dashboardPathForRole(role as string)).toBeNull()
  })
})
