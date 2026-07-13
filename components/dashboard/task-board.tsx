"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { DashTask, TaskTypeValue } from "./types";
import { isTodayOrOverdue } from "@/lib/dashboard/dates";
import { reorderTasksAction } from "@/app/actions/dashboard";
import { TaskSection } from "./task-section";

const TYPES: TaskTypeValue[] = ["task", "awaiting_supplier", "client_followup", "reminder"];

const SECTION_META = {
  task: { emoji: "📋", titleKey: "sections.today", emptyKey: "empty.today" },
  awaiting_supplier: { emoji: "⏳", titleKey: "sections.awaiting", emptyKey: "empty.awaiting" },
  client_followup: { emoji: "📞", titleKey: "sections.followup", emptyKey: "empty.followup" },
  reminder: { emoji: "🔔", titleKey: "sections.reminders", emptyKey: "empty.reminders" },
} as const satisfies Record<TaskTypeValue, { emoji: string; titleKey: string; emptyKey: string }>;

type Sections = Record<TaskTypeValue, DashTask[]>;

/** Group open tasks into the four sections, preserving server (manual) order. */
function groupTasks(tasks: DashTask[]): Sections {
  const out: Sections = { task: [], awaiting_supplier: [], client_followup: [], reminder: [] };
  for (const x of tasks) {
    // Future-dated plain tasks stay hidden until their day arrives.
    if (x.type === "task" && x.dueDate && !isTodayOrOverdue(x.dueDate)) continue;
    out[x.type].push(x);
  }
  return out;
}

/**
 * The four task sections as one drag & drop board: cards reorder within a
 * section and move across sections (which changes the item's type). Local
 * state gives instant feedback; the result is persisted via
 * `reorderTasksAction`, then `router.refresh()` re-syncs (scroll-preserving).
 */
export function TaskBoard({ tasks }: { tasks: DashTask[] }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sections, setSections] = useState<Sections>(() => groupTasks(tasks));

  // Re-sync from the server whenever the RSC payload changes (add/edit/refresh)
  // — the render-time "adjust state when props change" pattern, no effect needed.
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setSections(groupTasks(tasks));
  }

  // A small activation distance keeps plain taps (checkbox, buttons) working.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function findContainer(id: UniqueIdentifier): TaskTypeValue | null {
    if (TYPES.includes(id as TaskTypeValue)) return id as TaskTypeValue;
    return TYPES.find((ty) => sections[ty].some((x) => x.id === id)) ?? null;
  }

  /** Move the dragged card between sections live, so the drop slot is visible. */
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;
    setSections((prev) => {
      const fromList = [...prev[from]];
      const toList = [...prev[to]];
      const idx = fromList.findIndex((x) => x.id === active.id);
      if (idx === -1) return prev;
      const [moved] = fromList.splice(idx, 1);
      const overIdx = toList.findIndex((x) => x.id === over.id);
      toList.splice(overIdx === -1 ? toList.length : overIdx, 0, { ...moved, type: to });
      return { ...prev, [from]: fromList, [to]: toList };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const from = findContainer(active.id);
    if (!from) return;
    let next = sections;
    if (over && over.id !== active.id) {
      const to = findContainer(over.id);
      if (to === from) {
        const oldIdx = sections[from].findIndex((x) => x.id === active.id);
        const newIdx = sections[from].findIndex((x) => x.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1) {
          next = { ...sections, [from]: arrayMove(sections[from], oldIdx, newIdx) };
        }
      }
    }
    setSections(next);
    // Persist every section's order — the lists are small, and it keeps the
    // payload independent of which containers the drag passed through.
    const updates = TYPES.flatMap((ty) =>
      next[ty].map((x, i) => ({ id: x.id, type: ty, sortOrder: i })),
    );
    if (updates.length === 0) return;
    startTransition(async () => {
      const res = await reorderTasksAction(updates);
      if ("error" in res) toast.error(t("offline"));
      router.refresh();
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-6">
        {TYPES.map((ty) => (
          <TaskSection
            key={ty}
            type={ty}
            emoji={SECTION_META[ty].emoji}
            title={t(SECTION_META[ty].titleKey)}
            emptyText={t(SECTION_META[ty].emptyKey)}
            tasks={sections[ty]}
          />
        ))}
      </div>
    </DndContext>
  );
}
