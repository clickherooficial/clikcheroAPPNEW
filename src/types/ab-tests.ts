// ab-testing (Sprint 7/8) — tipos.

export type ABTestKind = 'campaign' | 'adset' | 'ad';
export type ABTestCriterion = 'ctr' | 'cpl' | 'roas' | 'conversions' | 'spend_efficiency';
export type ABTestWinner = 'a' | 'b' | 'tied' | 'inconclusive' | null;

export interface ABTestVariantSummary {
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
  };
  rate: number;
  sample: number;
}

export interface ABTestEvaluationSummary {
  criterion: ABTestCriterion;
  variant_a: ABTestVariantSummary;
  variant_b: ABTestVariantSummary;
  sufficient_sample: boolean;
  min_sample_required: number;
  diff_pct: number | null;
  decided_at: string;
  notes: string;
}

export interface ABTest {
  id: string;
  company_id: string;
  name: string;
  variant_a_kind: ABTestKind;
  variant_a_external_id: string;
  variant_a_label: string | null;
  variant_b_kind: ABTestKind;
  variant_b_external_id: string;
  variant_b_label: string | null;
  criterion: ABTestCriterion;
  started_at: string;
  ended_at: string | null;
  evaluated_at: string | null;
  winner_variant: ABTestWinner;
  evaluation_summary: ABTestEvaluationSummary | null;
  notes: string | null;
  created_at: string;
}
