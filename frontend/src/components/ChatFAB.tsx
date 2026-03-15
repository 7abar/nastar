"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, usePathname } from "next/navigation";

export function ChatFAB() {
  const { authenticated, login } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();

  // Hide on /chat page itself
  if (pathname === "/chat") return null;

  function handleClick() {
    if (!authenticated) {
      login();
      return;
    }
    router.push("/chat");
  }

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#F4C430] to-[#FF9F1C] shadow-[0_4px_24px_rgba(244,196,48,0.4)] hover:shadow-[0_4px_32px_rgba(244,196,48,0.6)] hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group"
      aria-label="Chat with Nastar"
    >
      {/* Chat bubble icon */}
      <svg
        className="w-6 h-6 text-[#0A0A0A] group-hover:scale-110 transition-transform"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75c1.838 0 3.558-.508 5.025-1.393l4.225 1.143-1.143-4.225A9.713 9.713 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75z"
        />
      </svg>

      {/* Tooltip */}
      <span className="absolute right-16 bg-[#1A1A1A] text-[#F5F5F5] text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
        Chat with Nastar
      </span>
    </button>
  );
}
