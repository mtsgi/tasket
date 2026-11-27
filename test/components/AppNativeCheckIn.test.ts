/**
 * Androidネイティブ環境における app.vue の PWAバナー抑止およびデイリーチェックイン動作テスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import App from '~/app.vue'
import { useStreakStore } from '~/stores/streak'
import { recordDailyActivity } from '~/utils/db'

vi.mock('~/utils/healthConnect', async () => {
  const actual = await vi.importActual<typeof import('~/utils/healthConnect')>('~/utils/healthConnect')
  return {
    ...actual,
    isNativeApp: vi.fn(() => true),
  }
})

describe('App.vue on Capacitor Native platform', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recordDailyActivity).mockResolvedValue(true)
  })

  it('Androidネイティブ環境でPWAインストールバナーを抑止しつつデイリーチェックインが正常に動作する', async () => {
    const streakStore = useStreakStore()
    const checkInSpy = vi.spyOn(streakStore, 'checkIn')

    const wrapper = await mountSuspended(App, {
      global: {
        stubs: {
          PWAInstallBanner: {
            template: '<div data-testid="pwa-install-banner" />',
          },
          DBBlockedBanner: true,
          LockScreen: true,
          NuxtPage: true,
          TutorialModal: true,
          DailyStreakModal: {
            props: ['show'],
            template: '<div data-testid="daily-streak-modal" :data-show="show" />',
          },
        },
      },
    })

    await flushPromises()

    // ネイティブ環境では PWAInstallBanner が描画されないこと
    expect(wrapper.find('[data-testid="pwa-install-banner"]').exists()).toBe(false)
    // デイリーチェックインが実行されること
    expect(checkInSpy).toHaveBeenCalled()
    expect(recordDailyActivity).toHaveBeenCalled()

    wrapper.unmount()
  })
})
