import { describe, expect, it } from 'vitest'
import { CUP_TABS, GROUP_TABS, LEAGUE_TABS, publicTabs } from './public-nav'

describe('publicTabs', () => {
  it('liga ma zakładki ligi', () => {
    expect(publicTabs([{ type: 'league' }])).toBe(LEAGUE_TABS)
  })

  it('sam puchar ma zakładki pucharu, z Drabinką w miejscu Tabeli', () => {
    expect(publicTabs([{ type: 'knockout' }])).toBe(CUP_TABS)
  })

  it('turniej z fazą grupową ma Tabelę i Drabinkę naraz, w kolejności z prototypu #252', () => {
    expect(publicTabs([{ type: 'group' }, { type: 'knockout' }])).toBe(GROUP_TABS)
    expect(GROUP_TABS).toEqual(['home', 'standings', 'bracket', 'fixtures', 'results', 'stats'])
  })
})
