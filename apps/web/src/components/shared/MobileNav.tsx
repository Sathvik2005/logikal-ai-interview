import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export type MobileNavItem = { to: string; icon: string; label: string };

export function MobileNav({
  items,
  rootPath,
  brand,
  subtitle,
}: {
  items: MobileNavItem[];
  rootPath: string;
  brand: string;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) =>
    to === rootPath ? pathname === rootPath : pathname.startsWith(to);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary-container"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined" aria-hidden>
          menu
        </span>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-surface p-md flex flex-col">
        <div className="mb-lg">
          <p className="font-headline-md text-headline-md font-bold text-primary">{brand}</p>
          {subtitle && <p className="text-body-md text-on-surface-variant mt-1">{subtitle}</p>}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive(item.to)
                  ? "bg-primary-container text-on-primary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined" aria-hidden>
                {item.icon}
              </span>
              <span className="text-body-md">{item.label}</span>
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
