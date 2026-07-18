"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { Faq } from "@/lib/faq";
import { toClientDashes } from "@/lib/utils";
import { deleteFaqAction, saveFaqAction, type FaqInput } from "@/app/actions/faq";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * The FAQ list: each question is a card; each answer variant is a block with
 * a product-label chip and a one-tap copy button (copies the clean answer
 * text for WhatsApp). Editors edit a card in place — question, per-variant
 * label/body, add/remove variants — plus add/delete whole questions.
 */

type Draft = FaqInput;

const EMPTY: Draft = { question: "", answers: [{ label: "", body: "" }] };

function toDraft(f: Faq): Draft {
  return {
    question: f.question,
    answers: f.answers.map((a) => ({ label: a.label ?? "", body: a.body })),
  };
}

export function FaqView({ items, canEdit }: { items: Faq[]; canEdit: boolean }) {
  const t = useTranslations("faq");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null);

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = tokens.length
    ? items.filter((f) => {
        const blob =
          `${f.question} ${f.answers.map((a) => `${a.label ?? ""} ${a.body}`).join(" ")}`.toLowerCase();
        return tokens.every((tok) => blob.includes(tok));
      })
    : items;

  function copyAnswer(key: string, body: string) {
    navigator.clipboard.writeText(toClientDashes(body)).then(
      () => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
        toast.success(t("copied"));
      },
      () => toast.error(t("copyFailed")),
    );
  }

  async function save() {
    if (editingId === null || saving) return;
    if (!draft.question.trim()) {
      toast.error(t("questionRequired"));
      return;
    }
    if (draft.answers.length === 0 || draft.answers.some((a) => !a.body.trim())) {
      toast.error(t("answerRequired"));
      return;
    }
    setSaving(true);
    const res = await saveFaqAction(editingId === "new" ? null : editingId, draft);
    setSaving(false);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("saved"));
    setEditingId(null);
    router.refresh();
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    const res = await deleteFaqAction(target.id);
    setDeleteTarget(null);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("deleted"));
    router.refresh();
  }

  function editor() {
    const setAnswer = (i: number, patch: Partial<Draft["answers"][number]>) =>
      setDraft((d) => ({
        ...d,
        answers: d.answers.map((a, ai) => (ai === i ? { ...a, ...patch } : a)),
      }));
    return (
      <div className="flex flex-col gap-3">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">{t("question")}</Label>
          <Input
            value={draft.question}
            dir="rtl"
            disabled={saving}
            onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
            className="font-bold"
          />
        </div>
        {draft.answers.map((a, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-2.5">
            <div className="flex items-end gap-2">
              <div className="grid flex-1 gap-1">
                <Label className="text-xs text-muted-foreground">{t("variantLabel")}</Label>
                <Input
                  value={a.label}
                  dir="rtl"
                  disabled={saving}
                  placeholder={t("variantPlaceholder")}
                  onChange={(e) => setAnswer(i, { label: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              {draft.answers.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("removeAnswer")}
                  disabled={saving}
                  onClick={() =>
                    setDraft((d) => ({ ...d, answers: d.answers.filter((_, ai) => ai !== i) }))
                  }
                  className="shrink-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <Textarea
              value={a.body}
              dir="rtl"
              disabled={saving}
              rows={5}
              onChange={(e) => setAnswer(i, { body: e.target.value })}
              className="text-sm leading-relaxed"
            />
          </div>
        ))}
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            setDraft((d) => ({ ...d, answers: [...d.answers, { label: "", body: "" }] }))
          }
          className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand">
          ➕ {t("addAnswer")}
        </button>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => setEditingId(null)}>
            <X className="size-4 text-destructive" /> {t("cancel")}
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={save}>
            <Check className="size-4" /> {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          className="ps-9"
        />
      </div>

      {visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {t("noResults")}
        </p>
      )}

      {visible.map((f) => (
        <Card key={f.id} size="sm" className="gap-0">
          <CardContent className="flex flex-col gap-3">
            {editingId === f.id ? (
              editor()
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    <span aria-hidden>❓ </span>
                    {f.question}
                  </h2>
                  {canEdit && (
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("edit")}
                        disabled={editingId !== null}
                        onClick={() => {
                          setDraft(toDraft(f));
                          setEditingId(f.id);
                        }}
                        className="text-muted-foreground hover:text-foreground">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("delete")}
                        disabled={editingId !== null}
                        onClick={() => setDeleteTarget(f)}
                        className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {f.answers.map((a, i) => {
                  const key = `${f.id}:${i}`;
                  return (
                    <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        {a.label ? (
                          <Badge className="border-transparent bg-brand/10 font-bold text-brand">
                            {a.label}
                          </Badge>
                        ) : (
                          <span />
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyAnswer(key, a.body)}
                          className="h-7 shrink-0 gap-1.5 px-2 text-xs">
                          {copiedKey === key ? (
                            <Check className="size-3.5 text-success" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          {t("copy")}
                        </Button>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                        {a.body}
                      </p>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {canEdit && editingId === "new" && (
        <Card size="sm" className="gap-0">
          <CardContent>{editor()}</CardContent>
        </Card>
      )}
      {canEdit && editingId === null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            setDraft(EMPTY);
            setEditingId("new");
          }}>
          <Plus className="size-4" /> {t("addQuestion")}
        </Button>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
