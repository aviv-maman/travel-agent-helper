"use client";

import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import type { DashTask, TaskTypeValue } from "./types";
import { TaskCard } from "./task-card";
import { AddItemPopover } from "./add-item-popover";

/** One task group: emoji heading + count badge + add button, then its cards or an empty state. */
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
      {tasks.length === 0 ? (
        <Empty className="border border-solid border-border/70 bg-surface py-6">
          <EmptyDescription>{emptyText}</EmptyDescription>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}
