import { CopyButton } from "./copy-button";

/** One-time backup codes, shown once with a copy-all button. */
export function BackupCodes({
  codes,
  title,
  hint,
}: {
  codes: string[];
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gold/30 bg-gold/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <CopyButton value={codes.join("\n")} />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm text-foreground">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  );
}
