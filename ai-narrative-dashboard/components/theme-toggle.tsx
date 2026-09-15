"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Включить светлую тему" : "Включить тёмную тему";
  return <Button type="button" variant="outline" size="icon" disabled={!mounted} onClick={() => setTheme(dark ? "light" : "dark")} aria-label={label} title={label} className="size-10 shrink-0 rounded-xl bg-card/80">{dark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}</Button>;
}
