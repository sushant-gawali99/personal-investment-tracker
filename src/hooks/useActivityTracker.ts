"use client";

import { useEffect, useRef } from "react";

const COOKIE_NAME = "pit-last-activity";
const DEBOUNCE_MS = 60_000; // at most one cookie write per minute

function writeActivityCookie() {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${Date.now()}; SameSite=Strict${secure}; Max-Age=604800; path=/`;
}

export function useActivityTracker() {
  const lastWriteRef = useRef<number>(0);

  useEffect(() => {
    writeActivityCookie(); // write immediately on mount

    function handleActivity() {
      const now = Date.now();
      if (now - lastWriteRef.current >= DEBOUNCE_MS) {
        lastWriteRef.current = now;
        writeActivityCookie();
      }
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, []);
}
