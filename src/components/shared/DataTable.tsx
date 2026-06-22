import { useState, type ReactNode } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface ColumnDef<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  rows: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  className?: string;
  stickyHeader?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  isLoading,
  emptyTitle = "No data",
  emptyHint,
  rowKey,
  onRowClick,
  pageSize = 20,
  className = "",
  stickyHeader = true,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
    setPage(1);
  };

  const sorted = [...rows].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const av = (a as Record<string, unknown>)[sortKey];
    const bv = (b as Record<string, unknown>)[sortKey];
    const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className={`bg-surface-container-lowest rounded-xl border border-outline-variant shadow-soft overflow-hidden ${className}`}>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-body-md" style={{ minWidth: "800px" }}>
          <thead className={`text-label-caps uppercase text-on-surface-variant bg-surface-container-low ${stickyHeader ? "sticky top-0 z-10" : ""}`}>
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`p-4 font-semibold tracking-wider whitespace-nowrap border-b border-outline-variant ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  } ${col.sortable ? "cursor-pointer select-none hover:bg-surface-container transition" : ""}`}
                  style={{ width: col.width }}
                  onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="material-symbols-outlined text-[14px] opacity-50">
                        {sortKey === String(col.key) ? (sortDir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/60">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="p-4">
                      <div className="h-4 bg-surface-container rounded animate-pulse" style={{ width: i % 2 === 0 ? "80%" : "60%" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant">inbox</span>
                    </div>
                    <p className="text-headline-sm text-on-surface">{emptyTitle}</p>
                    {emptyHint && <p className="text-body-md text-on-surface-variant max-w-sm">{emptyHint}</p>}
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr
                  key={rowKey ? rowKey(row) : row.id}
                  className={`hover:bg-surface-container-low/70 transition ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`p-4 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[String(col.key)] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/60">
          <p className="text-body-md text-on-surface-variant">
            {rows.length} result{rows.length !== 1 ? "s" : ""} • Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-body-md transition ${
                    p === page
                      ? "bg-primary text-on-primary"
                      : "border border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
