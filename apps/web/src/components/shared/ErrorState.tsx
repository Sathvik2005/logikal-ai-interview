import { useRouter } from "@tanstack/react-router";

export function ErrorState({
  error,
  reset,
  title = "Something went wrong",
}: {
  error?: Error | unknown;
  reset?: () => void;
  title?: string;
}) {
  const router = useRouter();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred.";

  const retry = () => {
    router.invalidate();
    reset?.();
  };

  return (
    <div className="flex flex-col items-center text-center py-xl px-md">
      <div className="w-14 h-14 rounded-full bg-error-container text-on-error-container flex items-center justify-center mb-md">
        <span className="material-symbols-outlined" aria-hidden>
          error
        </span>
      </div>
      <h3 className="text-headline-sm font-headline-sm text-on-surface">{title}</h3>
      <p className="text-body-md text-on-surface-variant mt-1 max-w-md">{message}</p>
      <button
        type="button"
        onClick={retry}
        className="mt-md px-6 py-2 rounded-lg bg-primary text-on-primary text-body-md font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary-container"
      >
        Try again
      </button>
    </div>
  );
}
