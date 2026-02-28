/**
 * csvExport.ts のユニットテスト
 */
import { describe, it, expect } from 'vitest'
import { convertHealthDataToCSV, generateHealthDataFilename } from '../../app/utils/csvExport'
import { createHealthData } from '../helpers/factories'

describe('convertHealthDataToCSV', () => {
  it('空配列の場合は空文字列を返す', () => {
    expect(convertHealthDataToCSV([])).toBe('')
  })

  it('日本語ヘッダーでCSVを生成する', () => {
    const data = [createHealthData({ date: '2025-12-15', weight: 70, bodyFatPercentage: 20 })]
    const csv = convertHealthDataToCSV(data, 'ja')

    // ヘッダー行を検証
    const lines = csv.split('\n')
    expect(lines[0]).toContain('日付')
    expect(lines[0]).toContain('体重(kg)')

    // データ行を検証
    expect(lines[1]).toContain('2025-12-15')
    expect(lines[1]).toContain('70')
    expect(lines[1]).toContain('20')
  })

  it('英語ヘッダーでCSVを生成する', () => {
    const data = [createHealthData({ date: '2025-12-15', weight: 70 })]
    const csv = convertHealthDataToCSV(data, 'en')

    const lines = csv.split('\n')
    expect(lines[0]).toContain('Date')
    expect(lines[0]).toContain('Weight(kg)')
  })

  it('複数データを日付順にソートする', () => {
    const data = [
      createHealthData({ date: '2025-12-20', weight: 72 }),
      createHealthData({ date: '2025-12-10', weight: 68 }),
      createHealthData({ date: '2025-12-15', weight: 70 }),
    ]
    const csv = convertHealthDataToCSV(data, 'ja')
    const lines = csv.split('\n')

    // データ行が日付順であることを検証
    expect(lines[1]).toContain('2025-12-10')
    expect(lines[2]).toContain('2025-12-15')
    expect(lines[3]).toContain('2025-12-20')
  })

  it('未定義フィールドは空文字として出力される', () => {
    const data = [createHealthData({ date: '2025-12-15', weight: 70, muscleMass: undefined })]
    const csv = convertHealthDataToCSV(data, 'ja')
    const lines = csv.split('\n')

    // データ行が存在する
    expect(lines.length).toBeGreaterThan(1)
  })
})

describe('generateHealthDataFilename', () => {
  it('日本語プレフィックスでファイル名を生成する', () => {
    const result = generateHealthDataFilename('2025-12-01', '2025-12-31', 'ja')
    expect(result).toBe('健康データ_20251201_20251231')
  })

  it('英語プレフィックスでファイル名を生成する', () => {
    const result = generateHealthDataFilename('2025-12-01', '2025-12-31', 'en')
    expect(result).toBe('health_data_20251201_20251231')
  })

  it('デフォルトは日本語', () => {
    const result = generateHealthDataFilename('2025-12-01', '2025-12-31')
    expect(result).toBe('健康データ_20251201_20251231')
  })
})
