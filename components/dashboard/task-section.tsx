"use client";

import { useTranslations } from "next-intl";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import type { DashTask, TaskTypeValue } from "./types";
import { TaskCard } from "./task-card";
import { AddItemPopover } from "./add-item-popover";

/**
 * One task group inside the drag & drop board (see task-board.tsx): emoji
 * heading + count + add button, then sortable cards. The list container is a
 * droppable target (id = the section's type) so items can be dragged into an
 * empty section too.
 */
export function TaskSection({
  emoji,
  title,
  emptyText,
  tasks,
  type,
}: {
  emoji: string;
  title: string;
  emptyText: string;
  tasks: DashTask[];
  type: TaskTypeValue;
}) {
  const { setNodeRef } = useDroppable({ id: type });
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm ring-1 ring-brand/15"
          aria-hidden>
          {emoji}
        </span>
        <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
        <Badge variant="secondary" className="ms-0.5">
          {tasks.length}
        </Badge>
        <div className="ms-auto">
          <AddItemPopover type={type} />
        </div>
      </div>
      <SortableContext items={tasks.map((x) => x.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2">
          {tasks.length === 0 ? (
            <Empty className="border border-solid border-border/70 bg-surface py-6">
              <EmptyDescription>{emptyText}</EmptyDescription>
            </Empty>
          ) : (
            tasks.map((task) => <SortableTaskCard key={task.id} task={task} />)
          )}
        </div>
      </SortableContext>
    </section>
  );
}

/** A TaskCard wrapped in dnd-kit sortable wiring, dragged via the grip handle. */
function SortableTaskCard({ task }: { task: DashTask }) {
  const t = useTranslations("dashboard.task");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "z-10 opacity-50" : undefined}>
      <TaskCard
        task={task}
        handle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t("drag")}
            // touch-none so dragging the handle doesn't scroll the page on mobile.
            className="mt-0.5 -ms-1.5 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-foreground active:cursor-grabbing">
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
}
