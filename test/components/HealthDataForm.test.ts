/**
 * HealthDataForm コンポーネントのユニットテスト
 * - 未保存フォーム入力がある状態での Health Connect 取得確認ダイアログ、編集値保護、および未編集項目のフォームDOM反映 (P2-5, Review #1)
 * - 書き込み処理中の非同期フォーム編集の保護 (Review #1)
 * - 未編集の睡眠セッションの秒以下精度保持 (P2-4)
 * - Health Connect 読み取り・書き込み結果（allFailed, localOnlyFields, invalidFields, 部分成功）の通知と lastSyncedAt 整合性 (P2-6, Review #5)
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

  function findNumberInputByLabel(wrapper: Awaited<ReturnType<typeof mountSuspended>>, labelText: string) {
    const groups = wrapper.findAll('.form-group')
    const targetGroup = groups.find(g => g.find('label').exists() && g.find('label').text() === labelText)
    if (!targetGroup) {
      throw new Error(`Form group with label "${labelText}" not found`)
    }
    return targetGroup.find('input[type="number"]')
  }

  it('未保存の手動入力がある状態で「Health Connectから取得」を押すとconfirmを表示し、編集中のフォーム入力値を保持したまま未編集項目のフォーム入力値にも取得データを反映する', async () => {
    const initialRecord = createHealthData({
      id: 'hd-1',
      date: testDate,
      weight: 65.0,
      bodyFatPercentage: undefined,
      steps: 3000,
      waterIntake: 800,
      healthMemo: '',
      healthConnectSync: {
        weight: 65.0,
        steps: 3000,
        waterIntake: 800,
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
      steps: 10500, // フォーム上で未編集のためストアおよびフォーム入力(DOM)が10500に更新されるべき
      waterIntake: 1500, // フォーム上で未編集のためストアおよびフォーム入力(DOM)が1500に更新されるべき
      readFields: ['weight', 'steps', 'waterIntake'],
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

    const weightInput = findNumberInputByLabel(wrapper, '体重')
    const stepsInput = findNumberInputByLabel(wrapper, '歩数')
    const waterInput = findNumberInputByLabel(wrapper, '水分摂取量')
    const memoTextarea = wrapper.find('textarea')

    expect((stepsInput.element as HTMLInputElement).value).toBe('3000')
    expect((waterInput.element as HTMLInputElement).value).toBe('800')

    // 体重と体調メモをフォーム上で編集（まだ「保存」は押さない）
    await weightInput.setValue('64.2')
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
    expect((weightInput.element as HTMLInputElement).value).toBe('64.2')
    expect((memoTextarea.element as HTMLTextAreaElement).value).toBe('未保存の体調メモ')

    // 未編集だった歩数・水分摂取量はストアだけでなくフォームの実際の input 値にも反映されていること (Review #1)
    expect((stepsInput.element as HTMLInputElement).value).toBe('10500')
    expect((waterInput.element as HTMLInputElement).value).toBe('1500')
    const healthDataStore = useHealthDataStore()
    expect(healthDataStore.getHealthDataByDateString(testDate)?.steps).toBe(10500)
    expect(healthDataStore.getHealthDataByDateString(testDate)?.waterIntake).toBe(1500)
  })

  it('Health Connectへの書き込み通信中にフォーム上で追加編集した内容は、完了後の再読み込みで上書きされず保持される', async () => {
    const initialRecord = createHealthData({
      id: 'hd-inflight-1',
      date: testDate,
      weight: 65.0,
      bodyFatPercentage: undefined,
      healthMemo: '初期メモ',
      healthConnectSync: {
        weight: 65.0,
      },
    })

    let dbRecord = { ...initialRecord }
    vi.mocked(getAllHealthData).mockImplementation(async () => [dbRecord])
    vi.mocked(getHealthDataByDate).mockImplementation(async () => dbRecord)
    vi.mocked(saveHealthData).mockImplementation(async (saved) => {
      dbRecord = { ...saved }
    })

    let resolveWrite!: (res: Awaited<ReturnType<typeof writeHealthConnectDailyData>>) => void
    vi.mocked(writeHealthConnectDailyData).mockImplementationOnce(() => new Promise((resolve) => {
      resolveWrite = resolve
    }))

    const settingsStore = useSettingsStore()
    settingsStore.healthConnectSettings = { enabled: true, lastSyncedAt: null }

    const wrapper = await mountSuspended(HealthDataForm, {
      props: { date: testDate },
    })
    await flushPromises()

    await wrapper.find('.health-data-header').trigger('click')
    await flushPromises()

    const weightInput = findNumberInputByLabel(wrapper, '体重')
    const memoTextarea = wrapper.find('textarea')
    await weightInput.setValue('64.0')

    // 書き込みを開始（Promise未解決状態）
    const hcButtons = wrapper.findAll('.hc-actions-buttons button')
    const writeClickPromise = hcButtons[1]!.trigger('click')
    await flushPromises()

    // 書き込み通信中にユーザーが体調メモを編集
    await memoTextarea.setValue('通信中に追記したメモ')

    // 書き込み完了
    resolveWrite({
      writtenFields: ['weight'],
      skippedPermissionFields: [],
      clientRecordVersions: { weight: 2001 },
    })
    await writeClickPromise
    await flushPromises()

    // 通信中に編集した体調メモが初期メモで上書きされずフォーム上に残っていること
    expect((memoTextarea.element as HTMLTextAreaElement).value).toBe('通信中に追記したメモ')
    expect((weightInput.element as HTMLInputElement).value).toBe('64')
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
    const weightInput = findNumberInputByLabel(wrapper, '体重')
    await weightInput.setValue('64.5')

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

  it('書き込み時に localOnlyFields や invalidFields が発生した場合に、ローカル保存のみ・無効値スキップ・部分成功を適切に区別して通知する', async () => {
    const initialRecord = createHealthData({
      id: 'hd-notify-1',
      date: testDate,
      weight: 65.0,
      bodyFatPercentage: undefined,
      waterIntake: 1000,
      healthConnectSync: {
        weight: 65.0,
        waterIntake: 1000,
        externalValues: { waterIntake: 1000 },
      },
    })

    let dbRecord = { ...initialRecord }
    vi.mocked(getAllHealthData).mockImplementation(async () => [dbRecord])
    vi.mocked(getHealthDataByDate).mockImplementation(async () => dbRecord)
    vi.mocked(saveHealthData).mockImplementation(async (saved) => {
      dbRecord = { ...saved }
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

    const waterInput = findNumberInputByLabel(wrapper, '水分摂取量')
    const weightInput = findNumberInputByLabel(wrapper, '体重')
    const hcButtons = wrapper.findAll('.hc-actions-buttons button')

    // 1. 読み取り権限不足等で localOnlyFields のみが返った場合 -> ローカル保存のみ通知し lastSyncedAt は更新しない
    await waterInput.setValue('1200')
    vi.mocked(writeHealthConnectDailyData).mockResolvedValueOnce({
      writtenFields: [],
      skippedPermissionFields: [],
      localOnlyFields: ['waterIntake'],
    })
    await hcButtons[1]!.trigger('click')
    await flushPromises()

    expect(updateSettingsSpy).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenLastCalledWith(
      expect.stringContaining('他アプリ由来のデータとの重複を防ぐため、ローカル保存のみ行いました'),
    )

    // 2. invalidFields のみが返った場合 -> 無効値スキップを通知し lastSyncedAt は更新しない
    await weightInput.setValue('600')
    vi.mocked(writeHealthConnectDailyData).mockResolvedValueOnce({
      writtenFields: [],
      skippedPermissionFields: [],
      invalidFields: ['weight'],
    })
    await hcButtons[1]!.trigger('click')
    await flushPromises()

    expect(updateSettingsSpy).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenLastCalledWith(
      expect.stringContaining('Health Connectへ書き込めない無効な値が含まれているため書き込みをスキップしました'),
    )

    // 3. weight は書き込み成功、waterIntake は localOnlyFields となった場合 -> 部分成功として通知し lastSyncedAt を更新する
    await weightInput.setValue('64.5')
    vi.mocked(writeHealthConnectDailyData).mockResolvedValueOnce({
      writtenFields: ['weight'],
      skippedPermissionFields: [],
      localOnlyFields: ['waterIntake'],
      clientRecordVersions: { weight: 3001 },
    })
    await hcButtons[1]!.trigger('click')
    await flushPromises()

    expect(updateSettingsSpy).toHaveBeenCalledOnce()
    expect(window.alert).toHaveBeenLastCalledWith(
      expect.stringContaining('一部の項目のみHealth Connectへ書き込みました'),
    )
  })
})
