/**
 * サンプルデータ管理ユーティリティ
 * Tasketの主要機能をデモンストレーションするためのサンプルデータを提供します。
 */
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import type { Item, Routine, Preset, HealthData } from '~/types/item'
import { addItem, addRoutine, addPreset, saveHealthData } from '~/utils/db'

/**
 * サンプルデータ定義
 * 各機能を網羅するための現実的なデータセット
 */
export interface SampleDataSet {
  items: Omit<Item, 'id' | 'created_at'>[]
  routines: Omit<Routine, 'id' | 'created_at'>[]
  presets: Omit<Preset, 'id' | 'created_at'>[]
  healthData: Omit<HealthData, 'id' | 'created_at' | 'updated_at'>[]
}

/**
 * サンプルデータを生成
 * 現在の日付を基準に過去・現在・未来のデータを作成
 */
export function generateSampleData(): SampleDataSet {
  const today = dayjs()
  const currentMonth = today.format('YYYY-MM')

  // TODOサンプルデータ
  const todoItems: Omit<Item, 'id' | 'created_at'>[] = [
    {
      title: 'プロジェクト資料作成',
      amount: 0,
      type: 'todo',
      is_completed: true,
      scheduled_at: today.subtract(2, 'day').hour(14).minute(0).toDate(),
      executed_at: today.subtract(2, 'day').hour(16).minute(30).toDate(),
      notes: 'クライアント向けの提案資料を作成',
    },
    {
      title: 'メール返信',
      amount: 0,
      type: 'todo',
      is_completed: true,
      scheduled_at: today.subtract(1, 'day').hour(10).minute(0).toDate(),
      executed_at: today.subtract(1, 'day').hour(10).minute(45).toDate(),
      notes: '重要な取引先への返信',
    },
    {
      title: '朝食',
      amount: 0,
      type: 'todo',
      is_completed: true,
      scheduled_at: today.subtract(1, 'day').hour(7).minute(30).toDate(),
      executed_at: today.subtract(1, 'day').hour(7).minute(45).toDate(),
      notes: '健康的な朝食',
      mealLog: {
        calories: 450,
        protein: 20,
        carbs: 55,
        fat: 12,
        memo: 'オートミール、バナナ、ヨーグルト',
      },
    },
    {
      title: '週次ミーティング',
      amount: 0,
      type: 'todo',
      is_completed: true,
      scheduled_at: today.hour(10).minute(0).toDate(),
      executed_at: today.hour(11).minute(0).toDate(),
      notes: 'チーム全体での進捗確認',
    },
    {
      title: 'ランチ',
      amount: 0,
      type: 'todo',
      is_completed: true,
      scheduled_at: today.hour(12).minute(30).toDate(),
      executed_at: today.hour(12).minute(45).toDate(),
      notes: '定食',
      mealLog: {
        calories: 680,
        protein: 32,
        carbs: 75,
        fat: 18,
        memo: 'チキン定食、サラダ付き',
      },
    },
    {
      title: '書類整理',
      amount: 0,
      type: 'todo',
      is_completed: false,
      scheduled_at: today.hour(15).minute(0).toDate(),
      executed_at: null,
      notes: '溜まっている書類を整理する',
    },
    {
      title: 'ジムでトレーニング',
      amount: 0,
      type: 'todo',
      is_completed: false,
      scheduled_at: today.hour(19).minute(0).toDate(),
      executed_at: null,
      notes: '週3回の運動習慣',
    },
    {
      title: '月次レポート作成',
      amount: 0,
      type: 'todo',
      is_completed: false,
      scheduled_at: today.add(1, 'day').hour(14).minute(0).toDate(),
      executed_at: null,
      notes: '今月の活動報告をまとめる',
    },
    {
      title: '友人との食事',
      amount: 0,
      type: 'todo',
      is_completed: false,
      scheduled_at: today.add(2, 'day').hour(18).minute(30).toDate(),
      executed_at: null,
      notes: '久しぶりの再会',
    },
  ]

  // 支出サンプルデータ
  const expenseItems: Omit<Item, 'id' | 'created_at'>[] = [
    {
      title: '昼食代',
      amount: 980,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(3, 'day').hour(12).minute(0).toDate(),
      executed_at: today.subtract(3, 'day').hour(12).minute(30).toDate(),
      notes: '定食屋でランチ',
      mealLog: {
        calories: 720,
        protein: 28,
        carbs: 82,
        fat: 22,
        memo: '日替わり定食',
      },
    },
    {
      title: '交通費',
      amount: 440,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(3, 'day').hour(9).minute(0).toDate(),
      executed_at: today.subtract(3, 'day').hour(9).minute(0).toDate(),
      notes: '電車往復',
    },
    {
      title: 'コーヒー',
      amount: 450,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(2, 'day').hour(15).minute(0).toDate(),
      executed_at: today.subtract(2, 'day').hour(15).minute(0).toDate(),
      notes: 'カフェで作業',
    },
    {
      title: '昼食代',
      amount: 1200,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(2, 'day').hour(12).minute(0).toDate(),
      executed_at: today.subtract(2, 'day').hour(12).minute(30).toDate(),
      notes: 'パスタランチ',
    },
    {
      title: '書籍購入',
      amount: 2800,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(2, 'day').hour(18).minute(0).toDate(),
      executed_at: today.subtract(2, 'day').hour(18).minute(0).toDate(),
      notes: '技術書2冊',
    },
    {
      title: 'スーパー',
      amount: 3500,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(1, 'day').hour(19).minute(0).toDate(),
      executed_at: today.subtract(1, 'day').hour(19).minute(30).toDate(),
      notes: '週末の食材まとめ買い',
    },
    {
      title: '昼食代',
      amount: 850,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(1, 'day').hour(12).minute(0).toDate(),
      executed_at: today.subtract(1, 'day').hour(12).minute(30).toDate(),
      notes: 'コンビニ弁当',
    },
    {
      title: '光熱費',
      amount: 8500,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.hour(0).minute(0).toDate(),
      executed_at: today.hour(0).minute(0).toDate(),
      notes: '電気・ガス・水道',
    },
    {
      title: 'コーヒー',
      amount: 420,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.hour(10).minute(0).toDate(),
      executed_at: today.hour(10).minute(0).toDate(),
      notes: 'コンビニコーヒー',
    },
    {
      title: '携帯電話代',
      amount: 6800,
      type: 'expense',
      is_completed: false,
      scheduled_at: today.add(1, 'day').hour(0).minute(0).toDate(),
      executed_at: null,
      notes: '月額料金',
    },
    {
      title: 'Netflixサブスクリプション',
      amount: 1490,
      type: 'expense',
      is_completed: false,
      scheduled_at: today.add(3, 'day').hour(0).minute(0).toDate(),
      executed_at: null,
      notes: 'スタンダードプラン',
    },
    {
      title: 'ガソリン代',
      amount: 5500,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(4, 'day').hour(18).minute(0).toDate(),
      executed_at: today.subtract(4, 'day').hour(18).minute(0).toDate(),
      notes: '満タン給油',
    },
    {
      title: '薬局',
      amount: 2300,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(3, 'day').hour(16).minute(0).toDate(),
      executed_at: today.subtract(3, 'day').hour(16).minute(0).toDate(),
      notes: '日用品・サプリメント',
    },
    {
      title: '美容院',
      amount: 4200,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(2, 'day').hour(14).minute(0).toDate(),
      executed_at: today.subtract(2, 'day').hour(16).minute(0).toDate(),
      notes: 'カット・シャンプー',
    },
    {
      title: 'クリーニング代',
      amount: 1800,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(1, 'day').hour(17).minute(0).toDate(),
      executed_at: today.subtract(1, 'day').hour(17).minute(0).toDate(),
      notes: 'スーツ3着',
    },
    {
      title: '映画チケット',
      amount: 1900,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(1, 'day').hour(13).minute(0).toDate(),
      executed_at: today.subtract(1, 'day').hour(13).minute(0).toDate(),
      notes: '週末鑑賞',
    },
    {
      title: '駐車場代',
      amount: 600,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.subtract(1, 'day').hour(13).minute(30).toDate(),
      executed_at: today.subtract(1, 'day').hour(13).minute(30).toDate(),
      notes: '映画館駐車場',
    },
    {
      title: 'インターネット料金',
      amount: 4980,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.hour(0).minute(0).toDate(),
      executed_at: today.hour(0).minute(0).toDate(),
      notes: '月額固定費',
    },
    {
      title: '保険料',
      amount: 12000,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.hour(0).minute(0).toDate(),
      executed_at: today.hour(0).minute(0).toDate(),
      notes: '生命保険月額',
    },
    {
      title: 'ジム会費',
      amount: 8800,
      type: 'expense',
      is_completed: true,
      scheduled_at: today.hour(0).minute(0).toDate(),
      executed_at: today.hour(0).minute(0).toDate(),
      notes: '月額会員費',
    },
  ]

  // 収入サンプルデータ
  const incomeItems: Omit<Item, 'id' | 'created_at'>[] = [
    {
      title: '給与',
      amount: 280000,
      type: 'income',
      is_completed: true,
      scheduled_at: today.subtract(5, 'day').hour(0).minute(0).toDate(),
      executed_at: today.subtract(5, 'day').hour(0).minute(0).toDate(),
      notes: '12月分給与',
    },
    {
      title: '副業収入',
      amount: 45000,
      type: 'income',
      is_completed: true,
      scheduled_at: today.subtract(3, 'day').hour(0).minute(0).toDate(),
      executed_at: today.subtract(3, 'day').hour(0).minute(0).toDate(),
      notes: 'フリーランス案件',
    },
    {
      title: 'ボーナス',
      amount: 350000,
      type: 'income',
      is_completed: false,
      scheduled_at: today.add(10, 'day').hour(0).minute(0).toDate(),
      executed_at: null,
      notes: '冬季賞与（予定）',
    },
  ]

  // すべてのアイテムを結合
  const items = [...todoItems, ...expenseItems, ...incomeItems]

  // 日課サンプルデータ（現在の月）
  const routines: Omit<Routine, 'id' | 'created_at'>[] = [
    {
      yearMonth: currentMonth,
      title: '朝の散歩',
      order: 0,
    },
    {
      yearMonth: currentMonth,
      title: '読書30分',
      order: 1,
    },
    {
      yearMonth: currentMonth,
      title: '英語学習',
      order: 2,
    },
    {
      yearMonth: currentMonth,
      title: '筋トレ',
      order: 3,
    },
    {
      yearMonth: currentMonth,
      title: '日記を書く',
      order: 4,
    },
  ]

  // プリセットサンプルデータ
  const presets: Omit<Preset, 'id' | 'created_at'>[] = [
    // TODOプリセット
    {
      title: '朝のメールチェック',
      time: '09:00',
      type: 'todo',
      amount: 0,
      notes: '',
    },
    {
      title: 'デイリーミーティング',
      time: '10:00',
      type: 'todo',
      amount: 0,
      notes: 'チームの朝会',
    },
    {
      title: '週報作成',
      time: '17:00',
      type: 'todo',
      amount: 0,
      notes: '金曜日に週次報告を作成',
    },
    // 支出プリセット
    {
      title: '昼食代',
      time: '12:00',
      type: 'expense',
      amount: 1000,
      notes: '',
    },
    {
      title: 'コーヒー',
      time: '15:00',
      type: 'expense',
      amount: 450,
      notes: 'カフェラテ',
    },
    {
      title: '交通費',
      time: '09:00',
      type: 'expense',
      amount: 440,
      notes: '電車往復',
    },
    {
      title: 'スーパー',
      time: '19:00',
      type: 'expense',
      amount: 3000,
      notes: '食材まとめ買い',
    },
    // 収入プリセット
    {
      title: '給与',
      time: '00:00',
      type: 'income',
      amount: 280000,
      notes: '月末給与',
    },
  ]

  // 健康データサンプル
  const healthDataSamples: Omit<HealthData, 'id' | 'created_at' | 'updated_at'>[] = [
    {
      date: today.subtract(7, 'day').format('YYYY-MM-DD'),
      weight: 68.5,
      bodyFatPercentage: 18.2,
      steps: 8200,
      sleepHours: 7.5,
      waterIntake: 2000,
      healthMemo: '体調良好',
    },
    {
      date: today.subtract(6, 'day').format('YYYY-MM-DD'),
      weight: 68.3,
      bodyFatPercentage: 18.1,
      steps: 9500,
      sleepHours: 7,
      exerciseMinutes: 45,
      waterIntake: 2200,
    },
    {
      date: today.subtract(5, 'day').format('YYYY-MM-DD'),
      weight: 68.4,
      bodyFatPercentage: 18.0,
      steps: 7800,
      sleepHours: 6.5,
      waterIntake: 1800,
    },
    {
      date: today.subtract(4, 'day').format('YYYY-MM-DD'),
      weight: 68.2,
      bodyFatPercentage: 17.9,
      steps: 10200,
      sleepHours: 8,
      exerciseMinutes: 60,
      waterIntake: 2500,
      healthMemo: 'ジムでトレーニング',
    },
    {
      date: today.subtract(3, 'day').format('YYYY-MM-DD'),
      weight: 68.0,
      bodyFatPercentage: 17.8,
      steps: 8900,
      sleepHours: 7.5,
      waterIntake: 2100,
    },
    {
      date: today.subtract(2, 'day').format('YYYY-MM-DD'),
      weight: 67.9,
      bodyFatPercentage: 17.7,
      systolicBloodPressure: 118,
      diastolicBloodPressure: 75,
      heartRate: 68,
      steps: 9200,
      sleepHours: 7,
      waterIntake: 2000,
    },
    {
      date: today.subtract(1, 'day').format('YYYY-MM-DD'),
      weight: 67.8,
      bodyFatPercentage: 17.6,
      steps: 11000,
      sleepHours: 7.5,
      exerciseMinutes: 50,
      waterIntake: 2300,
      healthMemo: '朝ランニング',
    },
    {
      date: today.format('YYYY-MM-DD'),
      weight: 67.7,
      bodyFatPercentage: 17.5,
      steps: 5200,
      sleepHours: 8,
      waterIntake: 1500,
    },
  ]

  return { items, routines, presets, healthData: healthDataSamples }
}

/**
 * サンプルデータをデータベースに追加
 * @returns 追加されたデータの件数
 */
export async function loadSampleData(): Promise<{
  itemsCount: number
  routinesCount: number
  presetsCount: number
  healthDataCount: number
}> {
  const sampleData = generateSampleData()

  // アイテムを追加
  for (const itemData of sampleData.items) {
    const item: Item = {
      id: uuidv4(),
      ...itemData,
      created_at: new Date(),
    }
    await addItem(item)
  }

  // 日課を追加
  for (const routineData of sampleData.routines) {
    const routine: Routine = {
      id: uuidv4(),
      ...routineData,
      created_at: new Date(),
    }
    await addRoutine(routine)
  }

  // プリセットを追加
  for (const presetData of sampleData.presets) {
    const preset: Preset = {
      id: uuidv4(),
      ...presetData,
      created_at: new Date(),
    }
    await addPreset(preset)
  }

  // 健康データを追加
  for (const healthDataItem of sampleData.healthData) {
    const healthData: HealthData = {
      id: uuidv4(),
      ...healthDataItem,
      created_at: new Date(),
      updated_at: new Date(),
    }
    await saveHealthData(healthData)
  }

  return {
    itemsCount: sampleData.items.length,
    routinesCount: sampleData.routines.length,
    presetsCount: sampleData.presets.length,
    healthDataCount: sampleData.healthData.length,
  }
}
