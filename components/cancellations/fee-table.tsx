import type { FeeLevel } from "@/lib/cancellations";

/** Fee severity → cell color. low = blue, net = gold, gross = orange, full = red. */
const FEE: Record<FeeLevel, string> = {
  low: "text-brand",
  net: "text-gold",
  gross: "text-warning",
  full: "text-destructive",
};

export type FeeTableRow = { timeframe: string; fee: string; level?: FeeLevel };

/** The 2-column fee schedule used by both the internal tiers and the client copy. */
export function FeeTable({
  headers,
  rows,
}: {
  headers?: [string, string] | null;
  rows: FeeTableRow[];
}) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-[62%]" />
        <col />
      </colgroup>
      {headers && (
        <thead>
          <tr>
            <th className="border-b border-border px-2 py-1.5 text-start text-xs font-bold text-muted-foreground">
              {headers[0]}
            </th>
            <th className="border-b border-border px-2 py-1.5 text-start text-xs font-bold text-muted-foreground">
              {headers[1]}
            </th>
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/50 last:border-b-0">
            <td className="px-2 py-1.5 align-middle text-sm text-foreground">{r.timeframe}</td>
            <td
              className={`px-2 py-1.5 align-middle text-sm font-bold ${
                r.level ? FEE[r.level] : "text-foreground"
              }`}>
              {r.fee}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
