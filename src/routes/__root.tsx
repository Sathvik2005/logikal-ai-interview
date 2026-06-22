import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center p-lg bg-background">
      <div className="text-center max-w-lg w-full">
        {/* Illustration */}
        <div className="relative inline-flex mb-8">
          <div className="w-40 h-40 rounded-full bg-surface-container-low border border-outline-variant flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="relative z-10">
              <circle cx="40" cy="40" r="28" stroke="var(--outline-variant)" strokeWidth="2" strokeDasharray="6 4" />
              <path d="M26 40h28M40 26v28" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.3" />
              <circle cx="40" cy="40" r="8" fill="var(--primary-container)" />
              <path d="M37 40l2 2 4-4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-error-container border border-outline-variant flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-[16px]">close</span>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-label-caps text-on-surface-variant border border-outline-variant/60">
          Error 404
        </div>
        <h1 className="text-display-lg font-display-lg text-on-surface tracking-tight mt-4 mb-3">
          Page not found
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-md mx-auto mb-8">
          The endpoint you requested doesn't exist or has been moved. Double-check the URL or navigate back to safety.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg shadow-soft hover:brightness-110 transition text-body-md font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Return Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 bg-surface-container-lowest text-on-surface border border-outline-variant px-6 py-3 rounded-lg hover:bg-surface-container-low transition text-body-md"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Go Back
          </button>
        </div>

        {/* Suggested pages */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg text-left">
          <p className="text-label-caps uppercase text-on-surface-variant mb-3 tracking-wider">Quick Navigation</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Recruiter Dashboard", icon: "dashboard", to: "/recruiter" },
              { label: "Candidate Management", icon: "groups", to: "/recruiter/candidates" },
              { label: "Interview Monitor", icon: "video_chat", to: "/recruiter/monitor" },
              { label: "AI Reports", icon: "analytics", to: "/recruiter/reports" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-container-low transition text-body-md text-on-surface"
              >
                <span className="material-symbols-outlined text-primary text-[18px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-8 text-body-md text-on-surface-variant/60">
          Logikality AI — Enterprise Recruitment Intelligence
        </p>
      </div>
    </div>
  );
}


function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center p-lg bg-background">
      <div className="text-center space-y-md max-w-md">
        <h1 className="text-headline-lg font-headline-lg text-on-surface">This page didn't load</h1>
        <p className="text-body-md text-on-surface-variant">Something went wrong on our end.</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="bg-primary text-on-primary px-6 py-3 rounded-lg shadow-soft hover:brightness-110">
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Logikality AI — Adaptive Intelligence Interview Platform" },
      { name: "description", content: "Enterprise recruitment workflows powered by adaptive AI interviewing, explainable evaluations, and intelligent recruiter analytics." },
      { property: "og:title", content: "Logikality AI — Adaptive Intelligence Interview Platform" },
      { name: "twitter:title", content: "Logikality AI — Adaptive Intelligence Interview Platform" },
      { property: "og:description", content: "Enterprise recruitment workflows powered by adaptive AI interviewing, explainable evaluations, and intelligent recruiter analytics." },
      { name: "twitter:description", content: "Enterprise recruitment workflows powered by adaptive AI interviewing, explainable evaluations, and intelligent recruiter analytics." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/625d9cc9-ad4a-4beb-8226-4c031d0be47c/id-preview-6b19fc0c--27be9937-4871-4f5e-a820-84aca02a3bf0.lovable.app-1780637466721.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/625d9cc9-ad4a-4beb-8226-4c031d0be47c/id-preview-6b19fc0c--27be9937-4871-4f5e-a820-84aca02a3bf0.lovable.app-1780637466721.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
