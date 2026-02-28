/**
 * settings ストアのユニットテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '~/stores/settings'

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('デフォルト値が正しい', () => {
      const store = useSettingsStore()
      expect(store.darkMode).toBe(false)
      expect(store.dateChangeLine).toBe(0)
      expect(store.language).toBe('ja')
      expect(store.backgroundImage).toBe('none')
      expect(store.calendarDisplay.showExpense).toBe(true)
      expect(store.calendarDisplay.showIncome).toBe(true)
    })
  })

  describe('getters', () => {
    describe('backgroundImageDisplay', () => {
      it('文字列の場合そのまま返す', () => {
        const store = useSettingsStore()
        store.backgroundImage = '/backgrounds/test.jpg'
        expect(store.backgroundImageDisplay).toBe('/backgrounds/test.jpg')
      })

      it('"none"の場合そのまま返す', () => {
        const store = useSettingsStore()
        store.backgroundImage = 'none'
        expect(store.backgroundImageDisplay).toBe('none')
      })
    })
  })

  describe('actions', () => {
    describe('loadSettings', () => {
      it('DBから設定を読み込む', async () => {
        const { getAppSettings } = await import('~/utils/db')
        vi.mocked(getAppSettings).mockResolvedValue({
          id: 'app-settings',
          hasSeenTutorial: true,
          lockEnabled: false,
          pinHash: null,
          biometricEnabled: false,
          biometricCredentialId: null,
          maxAttempts: 5,
          lockTimeout: 0,
          darkMode: true,
          darkModeSync: false,
          backgroundImage: '/test.jpg',
          dateChangeLine: 4,
          language: 'en',
          calendarDisplay: {
            showExpense: false,
            showIncome: true,
            showMainTask: true,
            showTaskCount: false,
          },
          updated_at: new Date(),
        })

        const store = useSettingsStore()
        await store.loadSettings()

        expect(store.darkMode).toBe(true)
        expect(store.dateChangeLine).toBe(4)
        expect(store.language).toBe('en')
        expect(store.backgroundImage).toBe('/test.jpg')
        expect(store.calendarDisplay.showExpense).toBe(false)
      })

      it('設定が存在しない場合はデフォルト値を維持する', async () => {
        const { getAppSettings } = await import('~/utils/db')
        vi.mocked(getAppSettings).mockResolvedValue(undefined)

        const store = useSettingsStore()
        await store.loadSettings()

        expect(store.darkMode).toBe(false)
        expect(store.dateChangeLine).toBe(0)
        expect(store.language).toBe('ja')
      })
    })

    describe('saveSettings', () => {
      it('設定をDBに保存する', async () => {
        const { saveAppSettings, getAppSettings } = await import('~/utils/db')
        vi.mocked(getAppSettings).mockResolvedValue(undefined)

        const store = useSettingsStore()
        await store.saveSettings()

        expect(saveAppSettings).toHaveBeenCalledOnce()
      })
    })

    describe('toggleDarkMode', () => {
      it('ダークモードを切り替える', async () => {
        const { saveAppSettings: _saveAppSettings, getAppSettings } = await import('~/utils/db')
        vi.mocked(getAppSettings).mockResolvedValue(undefined)

        const store = useSettingsStore()
        expect(store.darkMode).toBe(false)

        await store.toggleDarkMode()
        expect(store.darkMode).toBe(true)

        await store.toggleDarkMode()
        expect(store.darkMode).toBe(false)
      })
    })

    describe('setDateChangeLine', () => {
      it('日付変更線を設定する', async () => {
        const { saveAppSettings: _saveAppSettings, getAppSettings } = await import('~/utils/db')
        vi.mocked(getAppSettings).mockResolvedValue(undefined)

        const store = useSettingsStore()
        await store.setDateChangeLine(4)
        expect(store.dateChangeLine).toBe(4)
      })

      it('範囲外の値をクランプする', async () => {
        const { getAppSettings } = await import('~/utils/db')
        vi.mocked(getAppSettings).mockResolvedValue(undefined)

        const store = useSettingsStore()

        await store.setDateChangeLine(-1)
        expect(store.dateChangeLine).toBe(0)

        await store.setDateChangeLine(30)
        expect(store.dateChangeLine).toBe(23)
      })
    })

    describe('setLanguage', () => {
      it('言語を設定する', async () => {
        const { saveAppSettings: _saveAppSettings, getAppSettings } = await import('~/utils/db')
        vi.mocked(getAppSettings).mockResolvedValue(undefined)

        const store = useSettingsStore()
        await store.setLanguage('en')
        expect(store.language).toBe('en')

        await store.setLanguage('ja')
        expect(store.language).toBe('ja')
      })
    })

    describe('updateCalendarDisplay', () => {
      it('カレンダー表示設定を更新する', async () => {
        const { getAppSettings } = await import('~/utils/db')
        vi.mocked(getAppSettings).mockResolvedValue(undefined)

        const store = useSettingsStore()
        await store.updateCalendarDisplay({ showExpense: false })
        expect(store.calendarDisplay.showExpense).toBe(false)
        expect(store.calendarDisplay.showIncome).toBe(true) // 他の設定は維持
      })
    })

    describe('setHeight', () => {
      it('身長を設定する', async () => {
        const { getAppSettings } = await import('~/utils/db')
        vi.mocked(getAppSettings).mockResolvedValue(undefined)

        const store = useSettingsStore()
        await store.setHeight(170)
        expect(store.height).toBe(170)

        await store.setHeight(undefined)
        expect(store.height).toBeUndefined()
      })
    })
  })
})
