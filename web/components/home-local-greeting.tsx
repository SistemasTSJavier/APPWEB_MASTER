"use client";

import { useEffect, useState } from "react";

function greetingFromHour(hour: number): string {
  if (hour < 12) return "BUENOS DIAS";
  if (hour < 19) return "BUENAS TARDES";
  return "BUENAS NOCHES";
}

/** Saludo según la hora local del navegador (no la del servidor). */
export function HomeLocalGreeting({ className }: { className?: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const tick = () => setText(greetingFromHour(new Date().getHours()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className}>
      <span className={text ? "" : "invisible select-none"} aria-hidden={!text}>
        {text || "BUENOS DIAS"}
      </span>
    </span>
  );
}
