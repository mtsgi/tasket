/**
 * DBBlockedBanner コンポーネントのユニットテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import DBBlockedBanner from '~/components/shared/DBBlockedBanner.vue'
import { isDBUpgradeBlocked, subscribeDBBlocked } from '~/utils/db'

describe('DBBlockedBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isDBUpgradeBlocked).mockReturnValue(false)
  })

  it('ブロック状態の変化に応じて他タブを閉じる案内を表示・非表示する', async () => {
    let listener: ((blocked: boolean) => void) | null = null
    const unsubscribe = vi.fn()
    vi.mocked(subscribeDBBlocked).mockImplementation((cb) => {
      listener = cb
      return unsubscribe
    })

    const wrapper = mount(DBBlockedBanner, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          Icon: true,
        },
      },
    })

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    listener?.(true)
    await nextTick()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('データベースの更新が待機中です')
    expect(wrapper.text()).toContain('他のタブで開いているTasketを閉じてください')

    listener?.(false)
    await nextTick()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    wrapper.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
