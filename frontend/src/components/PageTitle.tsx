"use client";

import { useEffect } from "react";

const BASE = "Nastar Protocol";

export default function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} | ${BASE}`;
    return () => { document.title = BASE; };
  }, [title]);
  return null;
}
