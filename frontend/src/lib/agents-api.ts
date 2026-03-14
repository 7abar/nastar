// Agent management — generates wallets + API keys for registered agents
// Stores in localStorage for hackathon MVP (production would use a database)

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  ownerAddress: string; // owner wallet (Privy user)
  agentWallet: string; // generated agent wallet address
  agentPrivateKey: string; // generated agent PK (stored encrypted in prod)
  apiKey: string; // API key for external integrations
  apiKeyActive: boolean;
  agentNftId: number | null; // ERC-8004 NFT ID once minted
  serviceId: number | null; // ServiceRegistry ID once registered
  endpoint: string;
  tags: string[];
  pricePerCall: string; // in USDC units (e.g. "5.0")
  paymentToken: string;
  avatar: string | null;
  createdAt: number;
}

export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "nst_";
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export function generateAgentWallet(): { address: string; privateKey: string } {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  return { address: account.address, privateKey: pk };
}

// LocalStorage helpers (hackathon MVP — production uses DB)
const STORAGE_KEY = "nastar_agents";

export function getStoredAgents(): RegisteredAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function storeAgent(agent: RegisteredAgent): void {
  const agents = getStoredAgents();
  agents.push(agent);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export function updateAgent(id: string, updates: Partial<RegisteredAgent>): void {
  const agents = getStoredAgents();
  const idx = agents.findIndex((a) => a.id === id);
  if (idx >= 0) {
    agents[idx] = { ...agents[idx], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  }
}

export function getAgentByApiKey(apiKey: string): RegisteredAgent | null {
  const agents = getStoredAgents();
  return agents.find((a) => a.apiKey === apiKey && a.apiKeyActive) || null;
}
