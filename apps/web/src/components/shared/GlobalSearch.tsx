import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Header search that actually works: Enter jumps to the candidate list filtered by the query,
 * and "/" focuses the box from anywhere (unless the user is already typing in a field).
 */
export function GlobalSearch({
  placeholder = "Search candidates…  ( / )",
}: {
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative w-full max-w-[28rem] hidden md:block"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        navigate({ to: "/recruiter/candidates", search: q ? { q } : {} } as never);
      }}
    >
      <span
        className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline"
        aria-hidden
      >
        search
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-full focus:ring-2 focus:ring-primary-container outline-none text-body-md"
        placeholder={placeholder}
        type="search"
        aria-label="Search candidates"
      />
    </form>
  );
}
