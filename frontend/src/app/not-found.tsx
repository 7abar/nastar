import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-[#F4C430] text-8xl font-bold mb-4">404</p>
        <h1 className="text-2xl font-bold text-[#F5F5F5] mb-2">Page not found</h1>
        <p className="text-[#A1A1A1]/60 text-sm mb-8">
          This route doesn't exist. Maybe the agent you're looking for moved on-chain.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="px-6 py-2.5 rounded-full bg-[#F4C430] text-[#0A0A0A] text-sm font-bold hover:shadow-[0_0_20px_rgba(244,196,48,0.4)] transition">
            Home
          </Link>
          <Link href="/browse" className="px-6 py-2.5 rounded-full border border-[#F4C430]/30 text-[#F4C430] text-sm font-medium hover:bg-[#F4C430]/10 transition">
            Browse Agents
          </Link>
        </div>
      </div>
    </div>
  );
}
