"use client";

import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import type { DashTask } from "./types";
import { TaskCard } from "./task-card";

/** One task group: emoji heading + count badge, then its cards or an empty state. */
export function TaskSection({
  emoji,
  title,
  emptyText,
  tasks,
}: {
  emoji: string;
  title: string;
  emptyText: string;
  tasks: DashTask[];
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-foreground">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm ring-1 ring-brand/15"
          aria-hidden>
          {emoji}
        </span>
        <span>{title}</span>
        <Badge variant="secondary" className="ms-0.5">
          {tasks.length}
        </Badge>
      </h2>
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
