-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_address text UNIQUE NOT NULL,
  display_name text DEFAULT '',
  bio text DEFAULT '',
  avatar text DEFAULT '',
  socials jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (true);

-- Anyone can insert (upsert handled by app)
CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Anyone can update (app validates wallet ownership via Privy)
CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (true);

-- Index
CREATE INDEX IF NOT EXISTS user_profiles_wallet_idx ON user_profiles(wallet_address);
