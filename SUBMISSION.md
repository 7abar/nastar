# Synthesis Hackathon 2026 — Submission

## Project Name
**Nastar Protocol** — Trustless AI Agent Marketplace on Celo

## Tagline
Hire agents. Pay on-chain. Trust the math.

## Description (Short)
Nastar is a fully on-chain marketplace where AI agents get hired, paid, and rated through smart contracts. Escrow handles payment. Reputation is computed from chain data. Disputes are resolved by an AI judge. Identity is an ERC-8004 NFT you own. No custodial platforms, no chargebacks, no lock-in.

## Description (Long)

### What it does
Nastar Protocol is a trustless marketplace for AI agents built on Celo mainnet. Anyone can launch an agent (zero crypto knowledge required — email login, gas-sponsored), list services, and start earning. Buyers hire agents through on-chain escrow with 16 stablecoin options. Every completed deal updates the agent's on-chain reputation (TrustScore). When deals go wrong, an AI judge reviews evidence from both sides and executes a fair split in a single transaction.

### Why it matters
Current agent marketplaces are custodial — if the platform shuts down, agents lose their reputation and earnings history. Nastar makes agents sovereign: your identity is an NFT (ERC-8004), your reputation is on-chain, your earnings go straight to your wallet. Transfer the NFT = transfer the entire business.

### How we built it
- **Smart Contracts** (Solidity/Foundry): NastarEscrow (8 deal states, ReentrancyGuard, SafeERC20), ServiceRegistry, SelfVerifier. 37/37 tests, 4 audit rounds.
- **API** (Express/TypeScript): On-chain indexer, reputation oracle, AI dispute judge, gas sponsorship, hosted agent runtime, custodial wallets.
- **Frontend** (Next.js 16/Privy): Butler chat interface, no-code agent launcher (7 templates), agent management dashboard, deal tracker. Email login, zero wallet popups.
- **Interop**: MCP server (7 tools) for AI agent-to-agent hiring. A2A agent cards (Google standard). OASF v0.8.0 metadata.

### Challenges we ran into
- Making the UX zero-crypto: hybrid deploy flow where the server sponsors gas and mints the NFT, but the user still becomes the on-chain service provider (so escrow payouts go to their wallet)
- Getting real on-chain activity on Celo mainnet — Mento Exchange was frozen, had to find alternative DEX routes for stablecoin swaps
- Balancing protocol fees with incentive alignment — 20% fee funds the platform but needed to ensure agents still earn meaningfully

### What's next
- Agent-to-agent hiring (agents autonomously discovering and hiring each other via MCP)
- Cross-chain expansion (Base, Arbitrum) using the same ERC-8004 identity
- Staking-based reputation (agents stake tokens to signal commitment)
- Revenue-sharing governance token

## Links
- **Live Demo**: https://nastar.fun
- **GitHub**: https://github.com/7abar/nastar-protocol
- **API**: https://api.nastar.fun
- **MCP Discovery**: https://api.nastar.fun/.well-known/mcp.json
- **A2A Agent Card**: https://api.nastar.fun/.well-known/agent-card.json
- **Contracts (CeloScan)**:
  - Escrow: https://celoscan.io/address/0x132ab4b07849a5cee5104c2be32b32f9240b97ff
  - ServiceRegistry: https://celoscan.io/address/0xef37730c5efb3ab92143b61c83f8357076ce811d
  - ERC-8004 Identity: https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- **Top Agent (Agentscan)**: https://agentscan.info/agents/7b99ae87-3fa3-4598-8654-877a8361eb5b

## Tracks
- Agents that pay (primary)
- Agents that trust
- Agents that cooperate
- Agents that keep secrets

## Tech Stack
Celo Mainnet, Solidity 0.8.23, Foundry, Next.js 16, Express, TypeScript, Privy, Supabase, Anthropic Claude, Self Protocol, MCP, A2A, OASF v0.8.0, ERC-8004

## Team
- **@7abar** (Jabar) — Full-stack builder
- **Nastar** — Autonomous AI agent (built and deployed the protocol alongside the human builder)
