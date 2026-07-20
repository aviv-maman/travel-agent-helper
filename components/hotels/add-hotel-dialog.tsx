"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import {
  createEnrichedHotelAction,
  hotelEnrichStatusAction,
  startHotelEnrichAction,
  type EnrichDraft,
  type EnrichJob,
} from "@/app/actions/hotels";
import type { BoardCode, HotelFeatureValue } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const STEPS = ["apify", "places", "distances"] as const;
type FeatureKey =
  | "poolOut"
  | "poolIn"
  | "spa"
  | "waterpark"
  | "casino"
  | "casinoNear"
  | "outsideCenter";
const FEATURES: { value: HotelFeatureValue; key: FeatureKey }[] = [
  { value: "pool-out", key: "poolOut" },
  { value: "pool-in", key: "poolIn" },
  { value: "spa", key: "spa" },
  { value: "waterpark", key: "waterpark" },
  { value: "casino", key: "casino" },
  { value: "casino-near", key: "casinoNear" },
  { value: "outside-center", key: "outsideCenter" },
];
const BOARDS: BoardCode[] = ["bb", "hb", "fb"];

/** Add a hotel to an existing destination: paste link → enrich → review → save. */
export function AddHotelDialog({
  destIata,
  destName,
  onClose,
}: {
  destIata: string;
  destName: string;
  onClose: () => void;
}) {
  const t = useTranslations("hotels.add");
  const tf = useTranslations("hotels.filter");
  const tb = useTranslations("hotels.board");
  const router = useRouter();

  const [phase, setPhase] = useState<"input" | "progress" | "review">("input");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<EnrichJob | null>(null);
  const [draft, setDraft] = useState<EnrichDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const jobId = useRef<string | null>(null);

  function fail(code: "notConfigured" | "offline" | "invalid" | "failed" | "forbidden") {
    const key =
      code === "notConfigured"
        ? "errNotConfigured"
        : code === "offline"
          ? "errOffline"
          : code === "invalid"
            ? "errInvalid"
            : "errFailed";
    toast.error(t(key));
    setBusy(false);
    setPhase("input");
  }

  async function start() {
    if (busy || !url.trim()) return;
    setBusy(true);
    const res = await startHotelEnrichAction(destIata, url);
    if ("error" in res) return fail(res.error);
    jobId.current = res.jobId;
    setJob({ status: "running", steps: { apify: "running", places: "pending", distances: "pending" } });
    setBusy(false);
    setPhase("progress");
  }

  // Poll the backend job while enriching.
  useEffect(() => {
    if (phase !== "progress" || !jobId.current) return;
    let live = true;
    const id = setInterval(async () => {
      const res = await hotelEnrichStatusAction(jobId.current!);
      if (!live) return;
      if (!("status" in res)) {
        clearInterval(id);
        return fail(res.error);
      }
      setJob(res);
      if (res.status === "done" && res.draft) {
        clearInterval(id);
        setDraft(res.draft);
        setPhase("review");
      } else if (res.status === "error") {
        clearInterval(id);
        toast.error(res.error || t("errFailed"));
        setPhase("input");
      }
    }, 3000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFeature(f: HotelFeatureValue) {
    setDraft((d) =>
      d
        ? { ...d, features: d.features.includes(f) ? d.features.filter((x) => x !== f) : [...d.features, f] }
        : d,
    );
  }
  function toggleBoard(b: BoardCode) {
    setDraft((d) =>
      d ? { ...d, boards: d.boards.includes(b) ? d.boards.filter((x) => x !== b) : [...d.boards, b] } : d,
    );
  }

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    const res = await createEnrichedHotelAction(destIata, draft);
    setSaving(false);
    if ("error" in res) {
      toast.error(t("createFailed"));
      return;
    }
    toast.success(t("created"));
    onClose();
    router.refresh();
  }

  const image = draft?.google?.photoUrl ?? draft?.bookingImage ?? null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { city: destName })}</DialogTitle>
          <DialogDescription className="sr-only">{t("title", { city: destName })}</DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-border px-4 pt-3">
          {phase === "input" && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">{t("linkLabel")}</Label>
              <Input
                dir="ltr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.booking.com/hotel/…"
                onKeyDown={(e) => e.key === "Enter" && start()}
              />
              <p className="text-xs text-muted-foreground">{t("linkHint")}</p>
            </div>
          )}

          {phase === "progress" && (
            <div className="flex flex-col gap-3 py-2">
              <p className="text-sm font-medium">{t("enriching")}</p>
              <ul className="flex flex-col gap-2">
                {STEPS.map((s) => {
                  const state = job?.steps?.[s] ?? "pending";
                  return (
                    <li key={s} className="flex items-center gap-2 text-sm">
                      {state === "done" ? (
                        <Check className="size-4 text-success" />
                      ) : state === "running" ? (
                        <Loader2 className="size-4 animate-spin text-brand" />
                      ) : (
                        <span className="size-4 rounded-full border border-border" />
                      )}
                      <span className={state === "pending" ? "text-muted-foreground" : ""}>
                        {t(s === "apify" ? "stepApify" : s === "places" ? "stepPlaces" : "stepDistances")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {phase === "review" && draft && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="size-16 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="size-16 shrink-0 rounded-md bg-surface-2" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{draft.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {draft.bookingScore != null && `Booking ${draft.bookingScore}`}
                    {draft.google?.rating != null && ` · Google ${draft.google.rating}`}
                    {` · ${t("summary", { rooms: draft.rooms.length, distances: draft.distances.length })}`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                <Label className="text-xs text-muted-foreground">{t("stars")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  dir="ltr"
                  className="h-8 w-20 text-sm"
                  value={draft.stars ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, stars: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("amenities")}</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {FEATURES.map((f) => (
                    <label key={f.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={draft.features.includes(f.value)}
                        onChange={() => toggleFeature(f.value)}
                      />
                      {tf(f.key)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("boardLabel")}</Label>
                <div className="flex gap-4">
                  {BOARDS.map((b) => (
                    <label key={b} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={draft.boards.includes(b)}
                        onChange={() => toggleBoard(b)}
                      />
                      {tb(b)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy || saving}>
            {t("cancel")}
          </Button>
          {phase === "input" && (
            <Button type="button" onClick={start} disabled={busy || !url.trim()}>
              {busy ? <Spinner className="size-4" /> : t("start")}
            </Button>
          )}
          {phase === "review" && (
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : t("save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
