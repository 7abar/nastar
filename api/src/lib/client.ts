import { createPublicClient, http } from "viem";
import { celoAlfajores } from "../config.js";

export const publicClient = createPublicClient({
  chain: celoAlfajores,
  transport: http(),
});

// Deal status enum (mirrors Solidity)
export const DEAL_STATUS: Record<number, string> = {
  0: "Created",
  1: "Accepted",
  2: "Delivered",
  3: "Completed",
  4: "Disputed",
  5: "Refunded",
  6: "Expired",
};

// Serialize BigInt-containing objects for JSON responses
export function serialize<T>(obj: T): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}
