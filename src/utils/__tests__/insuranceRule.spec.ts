// src/utils/__tests__/insuranceRule.spec.ts

import { describe, it, expect } from 'vitest';
import { checkInsuranceEligibility } from '@/utils/insuranceRule';
import { TripStatus, InsuranceReasonType } from '@/types';

describe('checkInsuranceEligibility（不便險理賠決策引擎）', () => {
  it('Cancelled 狀態應直接判定符合理賠資格，無需計算延誤時間', () => {
    const result = checkInsuranceEligibility(TripStatus.Cancelled, null, null);

    expect(result.isEligible).toBe(true);
    expect(result.reasonType).toBe(InsuranceReasonType.Cancelled);
    expect(result.delayInfo).toBeNull();
  });

  it('Cancelled 狀態即使表定/實際時間皆準時，仍優先判定為取消理賠', () => {
    const result = checkInsuranceEligibility(
      TripStatus.Cancelled,
      '2026-08-28T10:00:00+08:00',
      '2026-08-28T10:00:00+08:00',
    );

    expect(result.isEligible).toBe(true);
    expect(result.reasonType).toBe(InsuranceReasonType.Cancelled);
  });

  it('準點（延誤 0 分鐘）不符合理賠資格', () => {
    const result = checkInsuranceEligibility(
      TripStatus.Normal,
      '2026-08-28T10:00:00Z',
      '2026-08-28T10:00:00Z',
    );

    expect(result.isEligible).toBe(false);
    expect(result.reasonType).toBe(InsuranceReasonType.NotEligible);
    expect(result.delayInfo).toEqual({
      isCalculable: true,
      delayMinutes: 0,
      isOverThreshold: false,
    });
  });

  it('提前抵達（負延誤分鐘數）不符合理賠資格', () => {
    const result = checkInsuranceEligibility(
      TripStatus.Normal,
      '2026-08-28T10:00:00Z',
      '2026-08-28T09:50:00Z',
    );

    expect(result.isEligible).toBe(false);
    expect(result.delayInfo?.delayMinutes).toBe(-10);
  });

  it('邊界值：延誤 59 分鐘未達門檻（門檻 60 分鐘），不符合理賠資格', () => {
    const result = checkInsuranceEligibility(
      TripStatus.Delayed,
      '2026-08-28T10:00:00Z',
      '2026-08-28T10:59:00Z',
    );

    expect(result.isEligible).toBe(false);
    expect(result.reasonType).toBe(InsuranceReasonType.NotEligible);
    expect(result.delayInfo).toEqual({
      isCalculable: true,
      delayMinutes: 59,
      isOverThreshold: false,
    });
  });

  it('邊界值：延誤剛好 60 分鐘達到門檻，符合理賠資格', () => {
    const result = checkInsuranceEligibility(
      TripStatus.Delayed,
      '2026-08-28T10:00:00Z',
      '2026-08-28T11:00:00Z',
    );

    expect(result.isEligible).toBe(true);
    expect(result.reasonType).toBe(InsuranceReasonType.DelayOver4Hours);
    expect(result.delayInfo).toEqual({
      isCalculable: true,
      delayMinutes: 60,
      isOverThreshold: true,
    });
  });

  it('跨日計算：表定為前一日深夜、實際為隔日凌晨，延誤分鐘數應正確跨日累加', () => {
    const result = checkInsuranceEligibility(
      TripStatus.Delayed,
      '2026-08-28T23:50:00Z',
      '2026-08-29T01:00:00Z',
    );

    expect(result.delayInfo?.delayMinutes).toBe(70);
    expect(result.isEligible).toBe(true);
    expect(result.reasonType).toBe(InsuranceReasonType.DelayOver4Hours);
  });

  it('缺少實際時間（尚未起飛/抵達）時無法計算延誤，判定不符合理賠資格', () => {
    const result = checkInsuranceEligibility(TripStatus.Normal, '2026-08-28T10:00:00Z', null);

    expect(result.isEligible).toBe(false);
    expect(result.delayInfo).toBeNull();
  });

  it('可自訂理賠門檻分鐘數（如正式環境 240 分鐘）', () => {
    const under = checkInsuranceEligibility(
      TripStatus.Delayed,
      '2026-08-28T10:00:00Z',
      '2026-08-28T13:00:00Z',
      240,
    );
    const over = checkInsuranceEligibility(
      TripStatus.Delayed,
      '2026-08-28T10:00:00Z',
      '2026-08-28T14:00:00Z',
      240,
    );

    expect(under.isEligible).toBe(false);
    expect(over.isEligible).toBe(true);
  });
});
