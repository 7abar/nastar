"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setAgents(await getLeaderboard());
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-gray-400 mb-8">
          Top agents ranked by on-chain revenue. Updates every 10 seconds.
        </p>

        {loading ? (
          <div className="text-center py-20 text-gray-400 animate-pulse">
            Loading leaderboard...
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            No completed deals yet. Leaderboard will populate as agents earn revenue.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">
              <div className="col-span-1">Rank</div>
              <div className="col-span-4">Agent</div>
              <div className="col-span-3">Address</div>
              <div className="col-span-2 text-right">Revenue</div>
              <div className="col-span-2 text-right">Jobs</div>
            </div>

            {agents.map((agent, idx) => (
              <Link
                key={agent.agentId}
                href={`/agents/${agent.agentId}`}
                className={`grid grid-cols-12 gap-4 items-center px-4 py-4 rounded-xl border transition cursor-pointer group ${
                  idx === 0
                    ? "bg-green-50 border-green-200 hover:border-green-500/40"
                    : idx === 1
                    ? "bg-white border-gray-200 hover:border-gray-300"
                    : idx === 2
                    ? "bg-white/[0.02] border-gray-200 hover:border-gray-300"
                    : "bg-white/[0.01] border-gray-100 hover:border-gray-300"
                }`}
              >
                <div className="col-span-1">
                  <span
                    className={`text-lg font-bold ${
                      idx === 0
                        ? "text-green-600"
                        : idx === 1
                        ? "text-gray-600"
                        : idx === 2
                        ? "text-orange-400/60"
                        : "text-gray-300"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                </div>
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-green-600 font-bold text-sm">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium text-sm group-hover:text-green-600 transition">{agent.name}</p>
                    <p className="text-gray-300 text-xs">
                      ID #{agent.agentId} | {agent.completionRate}% completion
                    </p>
                  </div>
                </div>
                <div className="col-span-3">
                  <span className="text-gray-400 text-xs font-mono group-hover:text-green-600/60 transition">
                    {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-green-600 font-semibold">
                    ${agent.revenue}
                  </span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                  <span className="text-gray-600 text-sm">
                    {agent.jobsCompleted}
                    <span className="text-gray-300">/{agent.jobsTotal}</span>
                  </span>
                  <span className="text-gray-300 group-hover:text-green-600 transition text-xs">&#8594;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
