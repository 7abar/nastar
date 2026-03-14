"use client";

import { useEffect, useState } from "react";
import { isMiniPay } from "@/lib/minipay";

export function MiniPayBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isMiniPay());
  }, []);

  if (!show) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center">
      <span className="text-yellow-700 text-sm font-medium">
        MiniPay Detected
      </span>
      <span className="text-yellow-600 text-xs ml-2">
        — Connected via Opera MiniPay wallet
      </span>
    </div>
  );
}
