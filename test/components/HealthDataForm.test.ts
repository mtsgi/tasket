/**
 * HealthDataForm コンポーネントのユニットテスト
 * - 未保存フォーム入力がある状態での Health Connect 取得確認ダイアログと編集値保護 (P2-5)
 * - 未編集の睡眠セッションの秒以下精度保持 (P2-4)
 * - Health Connect 読み取り全失敗・権限不足時のエラー処理と lastSyncedAt 不更新 (P2-6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import HealthDataForm from '~/components/DailyView/HealthDataForm.vue'
import { useHealthDataStore } from '~/stores/healthData'
import { useSettingsStore } from '~/stores/settings'
import { createHealthData } from '../helpers/factories'
import { getAllHealthData, getHealthDataByDate, saveHealthData } from '~/utils/db'
import { readHealthConnectDailyData, writeHealthConnectDailyData } from '~/utils/healthConnect'

vi.mock('~/utils/healthConnect', async () => {
  const actual = await vi.importActual<typeof import('~/utils/healthConnect')>('~/utils/healthConnect')
  return {
    ...actual,
    isAndroidNativeApp: vi.fn(() => true),
    readHealthConnectDailyData: vi.fn(),
    writeHealthConnectDailyData: vi.fn(),
  }
})

describe('HealthDataForm.vue', () => {
  const testDate = '2025-12-15'

  beforeEach(() => {
    vi.clearAllMocks()
    window.alert = vi.fn()
    window.confirm = vi.fn(() => true)
  })

  it('未保存の手動入力がある状態で「Health Connectから取得」を押すとconfirmを表示し、承認時は編集中の値を保持したまま未編集項目のみ反映する', async () => {
    const initialRecord = createHealthData({
      id: 'hd-1',
      date: testDate,
      weight: 65.0,
      bodyFatPercentage: undefined,
      steps: 3000,
      healthMemo: '',
      healthConnectSync: {
        weight: 65.0,
        steps: 3000,
      },
    })

    let dbRecord = { ...initialRecord }
    vi.mocked(getAllHealthData).mockImplementation(async () => [dbRecord])
    vi.mocked(getHealthDataByDate).mockImplementation(async () => dbRecord)
    vi.mocked(saveHealthData).mockImplementation(async (saved) => {
      dbRecord = { ...saved }
    })

    vi.mocked(readHealthConnectDailyData).mockResolvedValue({
      date: testDate,
      weight: 68.5, // HC側では68.5だが、フォーム上で64.2に未保存編集中のため保護されるべき
      steps: 10500, // フォーム上で未編集のため更新されるべき
      readFields: ['weight', 'steps'],
    })

    const settingsStore = useSettingsStore()
    settingsStore.healthConnectSettings = { enabled: true, lastSyncedAt: null }

    const wrapper = await mountSuspended(HealthDataForm, {
      props: { date: testDate },
    })
    await flushPromises()

    // フォームを展開
    await wrapper.find('.health-data-header').trigger('click')
    await flushPromises()

    // 体重と体調メモをフォーム上で編集（まだ「保存」は押さない）
    const numberInputs = wrapper.findAll('input[type="number"]')
    expect(numberInputs.length).toBeGreaterThan(0)
    await numberInputs[0]!.setValue('64.2')

    const memoTextarea = wrapper.find('textarea')
    await memoTextarea.setValue('未保存の体調メモ')

    // 1. confirm でキャンセルを選択した場合は取得を実行しない
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    const hcButtons = wrapper.findAll('.hc-actions-buttons button')
    expect(hcButtons.length).toBe(2)
    await hcButtons[0]!.trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalledOnce()
    expect(readHealthConnectDailyData).not.toHaveBeenCalled()

    // 2. confirm でOKを選択した場合は dirtyMetrics を保護して取得・マージする
    vi.mocked(window.confirm).mockReturnValueOnce(true)
    await hcButtons[0]!.trigger('click')
    await flushPromises()

    expect(readHealthConnectDailyData).toHaveBeenCalledWith(testDate)
    // フォーム上の未保存入力（体重 64.2、メモ '未保存の体調メモ'）が失われていないこと
    expect((numberInputs[0]!.element as HTMLInputElement).value).toBe('64.2')
    expect((memoTextarea.element as HTMLTextAreaElement).value).toBe('未保存の体調メモ')
    // 未編集だった歩数は Health Connect の 10500 に更新されていること
    const healthDataStore = useHealthDataStore()
    expect(healthDataStore.getHealthDataByDateString(testDate)?.steps).toBe(10500)
  })

  it('Health Connectから取得済みの未編集の睡眠セッションは、他項目を編集して書き込んでも秒以下のISO時刻精度を失わず再書き込みされない', async () => {
    const externalSleepSession = {
      startTime: '2025-12-14T14:15:42.500Z',
      endTime: '2025-12-14T21:45:18.250Z',
      id: 'hc-ext-sleep-1',
      dataOrigin: 'com.fitbit.FitbitMobile',
      source: 'external' as const,
    }

    const initialRecord = createHealthData({
      id: 'hd-sleep-1',
      date: testDate,
      weight: 65.0,
      bodyFatPercentage: undefined,
      sleepHours: 7.5,
      sleepSessions: [externalSleepSession],
      healthConnectSync: {
        weight: 65.0,
        sleepHours: 7.5,
        sleepSessions: [externalSleepSession],
      },
    })

    let dbRecord = { ...initialRecord }
    vi.mocked(getAllHealthData).mockImplementation(async () => [dbRecord])
    vi.mocked(getHealthDataByDate).mockImplementation(async () => dbRecord)
    vi.mocked(saveHealthData).mockImplementation(async (saved) => {
      dbRecord = { ...saved }
    })
    vi.mocked(writeHealthConnectDailyData).mockResolvedValue({
      writtenFields: ['weight'],
      skippedPermissionFields: [],
      clientRecordVersions: { weight: 1001 },
    })

    const settingsStore = useSettingsStore()
    settingsStore.healthConnectSettings = { enabled: true, lastSyncedAt: null }

    const wrapper = await mountSuspended(HealthDataForm, {
      props: { date: testDate },
    })
    await flushPromises()

    await wrapper.find('.health-data-header').trigger('click')
    await flushPromises()

    // 体重のみ 65.0 -> 64.5 に変更し、睡眠セッションには触れないまま「Health Connectへ書き込み」を押す
    const numberInputs = wrapper.findAll('input[type="number"]')
    await numberInputs[0]!.setValue('64.5')

    const hcButtons = wrapper.findAll('.hc-actions-buttons button')
    await hcButtons[1]!.trigger('click')
    await flushPromises()

    // Health Connect への書き込みペイロードには weight のみが含まれ、未編集の sleepSessions は含まれないこと
    expect(writeHealthConnectDailyData).toHaveBeenCalledOnce()
    const writeCallArgs = vi.mocked(writeHealthConnectDailyData).mock.calls[0]!
    expect(writeCallArgs[0]).toBe(testDate)
    expect(writeCallArgs[1].weight).toBe(64.5)
    expect(writeCallArgs[1].sleepSessions).toBeUndefined()

    // DBに保存された睡眠セッションの秒・ミリ秒精度も元のまま維持されていること
    expect(dbRecord.sleepSessions?.[0]?.startTime).toBe('2025-12-14T14:15:42.500Z')
    expect(dbRecord.sleepSessions?.[0]?.endTime).toBe('2025-12-14T21:45:18.250Z')
  })

  it('全項目の読み取りに失敗した場合（allFailed）は最終同期日時（lastSyncedAt）を更新せずエラーを通知する', async () => {
    vi.mocked(getAllHealthData).mockResolvedValue([])
    vi.mocked(getHealthDataByDate).mockResolvedValue(undefined)
    vi.mocked(readHealthConnectDailyData).mockResolvedValue({
      date: testDate,
      readFields: [],
      emptyFields: [],
      failedFields: ['steps', 'sleep', 'heartRate', 'weight', 'bodyFatPercentage', 'waterIntake', 'exerciseMinutes'],
    })

    const settingsStore = useSettingsStore()
    settingsStore.healthConnectSettings = { enabled: true, lastSyncedAt: null }
    const updateSettingsSpy = vi.spyOn(settingsStore, 'updateHealthConnectSettings')

    const wrapper = await mountSuspended(HealthDataForm, {
      props: { date: testDate },
    })
    await flushPromises()

    await wrapper.find('.health-data-header').trigger('click')
    await flushPromises()

    const hcButtons = wrapper.findAll('.hc-actions-buttons button')
    await hcButtons[0]!.trigger('click')
    await flushPromises()

    expect(updateSettingsSpy).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalled()
  })
})
