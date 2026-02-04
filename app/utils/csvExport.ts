/**
 * CSV出力ユーティリティ
 * 健康データをCSV形式でエクスポートする機能を提供
 */
import type { HealthData } from '~/types/item'
import dayjs from 'dayjs'

/**
 * 健康データをCSV形式に変換
 * @param healthDataList - エクスポートする健康データの配列
 * @param locale - 言語設定（'ja' または 'en'）
 * @returns CSV形式の文字列
 */
export function convertHealthDataToCSV(healthDataList: HealthData[], locale: 'ja' | 'en' = 'ja'): string {
  if (healthDataList.length === 0) {
    return ''
  }

  // CSVヘッダーの定義
  const headers = locale === 'ja'
    ? [
        '日付',
        '体重(kg)',
        '体脂肪率(%)',
        '筋肉量(kg)',
        '内臓脂肪レベル',
        '基礎代謝量(kcal)',
        '体内水分率(%)',
        '骨塩量(kg)',
        'タンパク質(%)',
        '最高血圧(mmHg)',
        '最低血圧(mmHg)',
        '心拍数(bpm)',
        '体温(℃)',
        '血中酸素濃度(%)',
        '睡眠時間(時間)',
        '歩数',
        '運動時間(分)',
        '消費カロリー(kcal)',
        '水分摂取量(ml)',
        '生理周期',
        '服薬記録',
        '体調メモ',
      ]
    : [
        'Date',
        'Weight(kg)',
        'Body Fat(%)',
        'Muscle Mass(kg)',
        'Visceral Fat Level',
        'Basal Metabolic Rate(kcal)',
        'Body Water(%)',
        'Bone Mass(kg)',
        'Protein(%)',
        'Systolic BP(mmHg)',
        'Diastolic BP(mmHg)',
        'Heart Rate(bpm)',
        'Body Temperature(℃)',
        'SpO2(%)',
        'Sleep Hours(h)',
        'Steps',
        'Exercise Time(min)',
        'Calories Burned(kcal)',
        'Water Intake(ml)',
        'Menstrual Cycle',
        'Medication Record',
        'Health Notes',
      ]

  // 日付順にソート
  const sortedData = [...healthDataList].sort((a, b) => a.date.localeCompare(b.date))

  // CSVの行を生成
  const rows = sortedData.map((data) => {
    return [
      escapeCsvValue(data.date),
      data.weight ?? '',
      data.bodyFatPercentage ?? '',
      data.muscleMass ?? '',
      data.visceralFatLevel ?? '',
      data.basalMetabolicRate ?? '',
      data.bodyWaterPercentage ?? '',
      data.boneMass ?? '',
      data.proteinPercentage ?? '',
      data.systolicBloodPressure ?? '',
      data.diastolicBloodPressure ?? '',
      data.heartRate ?? '',
      data.bodyTemperature ?? '',
      data.spo2 ?? '',
      data.sleepHours ?? '',
      data.steps ?? '',
      data.exerciseMinutes ?? '',
      data.caloriesBurned ?? '',
      data.waterIntake ?? '',
      escapeCsvValue(data.menstrualCycle ?? ''),
      escapeCsvValue(data.medicationRecord ?? ''),
      escapeCsvValue(data.healthMemo ?? ''),
    ].join(',')
  })

  // ヘッダーと行を結合
  return [headers.join(','), ...rows].join('\n')
}

/**
 * CSV値のエスケープ処理
 * カンマ、改行、ダブルクォートを含む値を適切にエスケープ
 * @param value - エスケープする値
 * @returns エスケープされた値
 */
function escapeCsvValue(value: string): string {
  if (!value) return ''

  // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    // ダブルクォートを2つにエスケープ
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

/**
 * CSVファイルとしてダウンロード
 * @param csvContent - CSV形式の文字列
 * @param filename - ファイル名（拡張子なし）
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // BOM付きUTF-8でエンコード（Excelで文字化けを防ぐため）
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })

  // ダウンロードリンクを生成
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // メモリ解放
  URL.revokeObjectURL(url)
}

/**
 * 日付範囲からファイル名を生成
 * @param startDate - 開始日（YYYY-MM-DD）
 * @param endDate - 終了日（YYYY-MM-DD）
 * @param locale - 言語設定
 * @returns ファイル名（拡張子なし）
 */
export function generateHealthDataFilename(startDate: string, endDate: string, locale: 'ja' | 'en' = 'ja'): string {
  const prefix = locale === 'ja' ? '健康データ' : 'health_data'
  const formattedStartDate = dayjs(startDate).format('YYYYMMDD')
  const formattedEndDate = dayjs(endDate).format('YYYYMMDD')

  return `${prefix}_${formattedStartDate}_${formattedEndDate}`
}
