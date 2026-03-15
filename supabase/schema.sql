-- ============================================================
-- Nastar Protocol — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Hosted Agents (No-Code Launcher) ─────────────────────────

CREATE TABLE IF NOT EXISTS hosted_agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_wallet text UNIQUE NOT NULL,
  owner_address text NOT NULL,
  api_key text NOT NULL,
  agent_nft_id integer,
  service_id integer,
  name text NOT NULL,
  description text,
  template_id text,
  system_prompt text,
  llm_provider text DEFAULT 'openai',
  llm_model text DEFAULT 'gpt-4o-mini',
  llm_api_key text,
  spending_limits jsonb DEFAULT '{"maxPerCallUsd":10,"dailyLimitUsd":50,"requireConfirmAboveUsd":25}',
  status text DEFAULT 'active',
  daily_spend numeric DEFAULT 0,
  daily_spend_reset timestamptz DEFAULT (now() + interval '1 day'),
  jobs_completed integer DEFAULT 0,
  total_earned numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── Agent Activity Logs ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_wallet text NOT NULL,
  type text NOT NULL CHECK (type IN ('job', 'spend', 'error', 'approval')),
  message text NOT NULL,
  amount text,
  tx_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_logs_wallet_idx ON agent_logs(agent_wallet);
CREATE INDEX IF NOT EXISTS agent_logs_created_idx ON agent_logs(created_at DESC);

-- ── AI Judge Cases ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS judge_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id text UNIQUE NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'deliberating', 'decided', 'executed')),
  verdict jsonb,
  requested_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS judge_evidence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('buyer', 'seller')),
  evidence_text text NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, role)
);

CREATE INDEX IF NOT EXISTS judge_evidence_deal_idx ON judge_evidence(deal_id);

-- ── Registered Agents (replaces localStorage) ────────────────

CREATE TABLE IF NOT EXISTS registered_agents (
  id text PRIMARY KEY,
  owner_address text NOT NULL,
  agent_wallet text UNIQUE NOT NULL,
  agent_private_key text,
  api_key text NOT NULL,
  api_key_active boolean DEFAULT true,
  name text NOT NULL,
  description text,
  agent_nft_id integer,
  service_id integer,
  endpoint text,
  tags text[] DEFAULT '{}',
  price_per_call text,
  payment_token text,
  avatar text,
  created_at bigint
);

CREATE INDEX IF NOT EXISTS registered_agents_owner_idx ON registered_agents(owner_address);

-- ── Reputation Cache ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reputation_cache (
  agent_id integer PRIMARY KEY,
  score integer DEFAULT 0,
  tier text DEFAULT 'New',
  metrics jsonb DEFAULT '{}',
  breakdown jsonb DEFAULT '{}',
  last_updated timestamptz DEFAULT now()
);

-- ── updated_at trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hosted_agents_updated_at
  BEFORE UPDATE ON hosted_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER judge_cases_updated_at
  BEFORE UPDATE ON judge_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Disable RLS (hackathon MVP — enable + policies in production) ──

ALTER TABLE hosted_agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE judge_cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE judge_evidence DISABLE ROW LEVEL SECURITY;
ALTER TABLE registered_agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_cache DISABLE ROW LEVEL SECURITY;
