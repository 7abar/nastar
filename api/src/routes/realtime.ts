import { Router } from "express";
import {
  getStats,
  getLeaderboard,
  getServices,
  getDeals,
  getServiceById,
  getDealById,
  getDealsByAgent,
  getOpenBounties,
} from "../lib/indexer.js";

const router = Router();

// ── Stats (home page) ───────────────────────────────────────────────────────
router.get("/stats", (_req, res) => {
  const stats = getStats();
  res.json({
    totalRevenue: stats.totalRevenue,
    totalDeals: stats.totalDeals,
    totalCompletedDeals: stats.totalCompletedDeals,
    totalActiveServices: stats.totalActiveServices,
    totalAgents: stats.totalAgents,
    lastUpdated: stats.lastUpdated,
    lastBlock: stats.lastBlock,
  });
});

// ── Leaderboard ──────────────────────────────────────────────────────────────
router.get("/leaderboard", (_req, res) => {
  const lb = getLeaderboard();
  res.json(
    lb.map((a) => ({
      agentId: a.agentId,
      name: a.name,
      address: a.address,
      revenue: a.revenueFormatted,
      jobsCompleted: a.jobsCompleted,
      jobsTotal: a.jobsTotal,
      jobsDisputed: a.jobsDisputed,
      completionRate: a.completionRate,
    }))
  );
});

// ── Services (offerings) ─────────────────────────────────────────────────────
router.get("/services", (req, res) => {
  const services = getServices();
  const tag = req.query.tag as string | undefined;
  const q = req.query.q as string | undefined;

  let filtered = services;
  if (tag) {
    filtered = filtered.filter(
      (s) => s.name.toLowerCase().includes(tag.toLowerCase()) ||
        s.description.toLowerCase().includes(tag.toLowerCase())
    );
  }
  if (q) {
    const words = q.toLowerCase().split(" ");
    filtered = filtered.filter((s) =>
      words.some(
        (w) =>
          w.length > 1 &&
          (s.name.toLowerCase().includes(w) ||
            s.description.toLowerCase().includes(w))
      )
    );
  }

  res.json(filtered);
});

router.get("/services/:id", (req, res) => {
  const svc = getServiceById(Number(req.params.id));
  if (!svc) return res.status(404).json({ error: "Service not found" });
  res.json(svc);
});

// ── Deals ────────────────────────────────────────────────────────────────────
router.get("/deals", (req, res) => {
  const deals = getDeals();
  const status = req.query.status as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  let filtered = deals;
  if (status !== undefined) {
    filtered = filtered.filter((d) => d.status === Number(status));
  }

  const total = filtered.length;
  const page = [...filtered].reverse().slice(offset, offset + limit);
  // Strip bigint fields for JSON serialization
  res.json({ deals: page.map(d => ({ ...d, amountRaw: undefined })), total, offset, limit });
});

router.get("/deals/:id", (req, res) => {
  const deal = getDealById(Number(req.params.id));
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  res.json(deal);
});

router.get("/deals/agent/:agentId", (req, res) => {
  const agentDeals = getDealsByAgent(Number(req.params.agentId));
  // Strip bigint fields for JSON serialization
  res.json(agentDeals.map(d => ({
    ...d,
    amountRaw: undefined,
    amount: d.amount,
  })));
});

// ── Bounties (open deals) ────────────────────────────────────────────────────
router.get("/bounties", (_req, res) => {
  res.json(getOpenBounties());
});

// ── Recent jobs ──────────────────────────────────────────────────────────────
router.get("/recent", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const stats = getStats();
  res.json(stats.recentDeals.slice(0, limit));
});

export default router;
