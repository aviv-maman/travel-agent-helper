"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, LayoutGrid, Landmark } from "lucide-react";
import type { DashTask } from "./types";
import type { BankDetails } from "@/lib/dashboard/bank";
import type { GreetingKey } from "@/lib/dashboard/dates";
import { isSameJerusalemDay, isTodayOrOverdue } from "@/lib/dashboard/dates";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Greeting } from "./greeting";
import { BankDetailsCard } from "./bank-details-card";
import { QuickAddBar } from "./quick-add-bar";
import { TaskSection } from "./task-section";
import { TaskCard } from "./task-card";
import { Playground } from "./playground";

/**
 * Client orchestrator. A time-of-day greeting leads; a Workspace tab holds the
 * scratchpad (above the tasks), quick-add, the four task sections, completed
 * items and quick links; a Bank tab holds the transfer-details card.
 */
export function DashboardView({
  tasks,
  doneTasks,
  scratchpad,
  bank,
  agentName,
  greeting,
}: {
  tasks: DashTask[];
  doneTasks: DashTask[];
  scratchpad: string;
  bank: BankDetails;
  agentName: string;
  greeting: GreetingKey;
}) {
  const t = useTranslations("dashboard");

  const todayTasks = tasks.filter(
    (x) => x.type === "task" && (!x.dueDate || isTodayOrOverdue(x.dueDate)),
  );
  const awaiting = tasks.filter((x) => x.type === "awaiting_supplier");
  const followup = tasks.filter((x) => x.type === "client_followup");
  const reminders = tasks.filter((x) => x.type === "reminder");
  const completedToday = doneTasks.filter(
    (x) => x.completedAt && isSameJerusalemDay(new Date(x.completedAt)),
  );

  return (
    <div className="flex flex-col gap-5">
      <Greeting name={agentName} greeting={greeting} />

      <Tabs defaultValue="main">
        <TabsList className="rounded-xl">
          <TabsTrigger value="main">
            <LayoutGrid className="size-4" aria-hidden />
            {t("tabs.main")}
          </TabsTrigger>
          <TabsTrigger value="bank">
            <Landmark className="size-4" aria-hidden />
            {t("tabs.bank")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="flex flex-col gap-6 pt-3">
          <Playground initialContent={scratchpad} />
          <QuickAddBar />

          <div className="flex flex-col gap-6">
            <TaskSection
              emoji="📋"
              title={t("sections.today")}
              emptyText={t("empty.today")}
              tasks={todayTasks}
            />
            <TaskSection
              emoji="⏳"
              title={t("sections.awaiting")}
              emptyText={t("empty.awaiting")}
              tasks={awaiting}
            />
            <TaskSection
              emoji="📞"
              title={t("sections.followup")}
              emptyText={t("empty.followup")}
              tasks={followup}
            />
            <TaskSection
              emoji="🔔"
              title={t("sections.reminders")}
              emptyText={t("empty.reminders")}
              tasks={reminders}
            />
          </div>

          {completedToday.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground [&[data-panel-open]>svg]:rotate-180">
                <ChevronDown className="size-4 transition-transform" aria-hidden />
                {t("sections.completed")}
                <Badge variant="secondary">{completedToday.length}</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 flex flex-col gap-2">
                {completedToday.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </TabsContent>

        <TabsContent value="bank" className="pt-3">
          <BankDetailsCard bank={bank} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
