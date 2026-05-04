-- agency-mode (Sprint 8/8)
-- Coluna preferred_ad_account_external_id em companies pra suportar agencies multi-conta.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS preferred_ad_account_external_id text;

COMMENT ON COLUMN companies.preferred_ad_account_external_id IS
  'External ID Meta da ad_account preferida (act_XXXX ou XXXX). NULL = usa primeira de meta_ad_accounts. Setar via UI Account Switcher ou tool set_preferred_ad_account.';
