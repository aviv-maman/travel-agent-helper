"use client";

import * as React from "react";
import {
  type Column,
  type ColumnDef,
  type FilterFn,
  type RowData,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Per-column extras: a human label for the visibility menu, plus optional
// class names applied to the column's header and body cells.
declare module "@tanstack/react-table" {
  // Type params must match TanStack's ColumnMeta exactly for declaration merging.
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    headerClassName?: string;
    cellClassName?: string;
  }
}

export type DataTableLabels = {
  /** Search input placeholder; search box is hidden when omitted. */
  search?: string;
  clear: string;
  noResults: string;
  /** Column-visibility button + menu heading. */
  columns: string;
  /** Total filtered-row count; hidden when omitted. */
  total?: (_count: number) => string;
  perPage: string;
  page: (_page: number, _total: number) => string;
  prev: string;
  next: string;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  labels: DataTableLabels;
  globalFilterFn?: FilterFn<TData>;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  initialSorting?: SortingState;
  /** Optional per-row class (e.g. to highlight a catch-all row). */
  rowClassName?: (_row: TData) => string;
}

/** A sortable column header — renders a sort-toggle button when the column can sort. */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) {
    return <span className={cn("text-xs font-bold tracking-wide", className)}>{title}</span>;
  }
  const sorted = column.getIsSorted();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "-ms-2.5 h-7 px-2.5 text-xs font-bold tracking-wide text-muted-foreground hover:text-foreground",
        className,
      )}>
      <span>{title}</span>
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-50" />
      )}
    </Button>
  );
}

export function DataTable<TData, TValue>({
  columns,
  data,
  labels,
  globalFilterFn,
  pageSizeOptions = [25, 50, 100],
  initialPageSize = 100,
  initialSorting = [],
  rowClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: initialPageSize } },
  });

  const hideableColumns = table.getAllColumns().filter((c) => c.getCanHide());
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: search + column visibility */}
      <div className="flex items-center gap-2">
        {labels.search !== undefined && (
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={labels.search}
              className="ps-9 pe-9"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => setGlobalFilter("")}
                aria-label={labels.clear}
                className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive">
                <X className="size-4" />
              </button>
            )}
          </div>
        )}

        {hideableColumns.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline">
                  <SlidersHorizontal className="size-4" />
                  <span className="hidden sm:inline">{labels.columns}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                {labels.columns}
              </div>
              <DropdownMenuSeparator />
              {hideableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}>
                  {column.columnDef.meta?.label ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.columnDef.meta?.headerClassName}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={rowClassName?.(row.original)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.cellClassName}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground">
                  {labels.noResults}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {labels.total && (
          <span className="text-xs text-muted-foreground">{labels.total(filteredCount)}</span>
        )}

        <div className="ms-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{labels.perPage}</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={!table.getCanPreviousPage()}
                aria-label={labels.prev}
                onClick={() => table.previousPage()}>
                <ChevronLeft className="size-4 rtl:rotate-180" />
              </Button>
              <span className="px-1 text-xs whitespace-nowrap text-muted-foreground">
                {labels.page(pageIndex + 1, pageCount)}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={!table.getCanNextPage()}
                aria-label={labels.next}
                onClick={() => table.nextPage()}>
                <ChevronRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
