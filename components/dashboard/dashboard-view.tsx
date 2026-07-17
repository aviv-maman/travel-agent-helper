"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, LayoutGrid, Landmark, Newspaper } from "lucide-react";
import type { DashTask } from "./types";
import type { BankDetails } from "@/lib/dashboard/bank";
import type { GreetingKey } from "@/lib/dashboard/dates";
import type { NewsArticle } from "@/lib/news";
import { isSameJerusalemDay } from "@/lib/dashboard/dates";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Greeting } from "./greeting";
import { BankDetailsCard } from "./bank-details-card";
import { TaskBoard } from "./task-board";
import { TaskCard } from "./task-card";
import { Playground } from "./playground";
import { NewsList } from "@/components/news/news-list";
import { RefreshNewsButton } from "@/components/news/refresh-news-button";

/**
 * Client orchestrator. A time-of-day greeting leads; a Workspace tab holds the
 * scratchpad (above the tasks), quick-add, the four task sections, completed
 * items and quick links; a Bank tab holds the transfer-details card; a News
 * tab holds the tourism feed (moved off the main nav, 2026-07).
 */
export function DashboardView({
  tasks,
  doneTasks,
  scratchpad,
  bank,
  articles,
  newsSources,
  canRefreshNews,
  agentName,
  greeting,
}: {
  tasks: DashTask[];
  doneTasks: DashTask[];
  scratchpad: string;
  bank: BankDetails;
  articles: NewsArticle[];
  newsSources: { id: string; name: string }[];
  canRefreshNews: boolean;
  agentName: string;
  greeting: GreetingKey;
}) {
  const t = useTranslations("dashboard");

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
          <TabsTrigger value="news">
            <Newspaper className="size-4" aria-hidden />
            {t("tabs.news")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="flex flex-col gap-6 pt-3">
          <Playground initialContent={scratchpad} />
          <TaskBoard tasks={tasks} />

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

        <TabsContent value="news" className="flex flex-col gap-4 pt-3">
          {canRefreshNews && (
            <div className="flex justify-end">
              <RefreshNewsButton />
            </div>
          )}
          <NewsList articles={articles} sources={newsSources} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
