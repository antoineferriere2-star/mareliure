/**
 * Le fil d'un projet, tenu à jour sans architecture temps réel.
 *
 * Supabase Realtime obligerait à ouvrir les tables du fil aux comptes
 * connectés et à réécrire le modèle d'accès en politiques SQL. À la place : un
 * sondage léger d'une signature d'activité toutes les huit secondes, onglet
 * visible seulement, et la lecture complète — URL signées comprises — refaite
 * uniquement quand cette signature change. Chaque action invalide le fil tout
 * de suite, si bien qu'un message envoyé apparaît sans attendre.
 */
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getProjectThread,
  getProjectThreadActivity,
  markProjectThreadRead,
} from "@/marketplace/services/projectThread.functions";

export type ProjectThreadData = Awaited<ReturnType<typeof getProjectThread>>;
export type ProjectDecisionData = ProjectThreadData["decisions"][number];

export const ACTIVITY_POLL_MS = 8_000;

export function useProjectThread(caseId: string, enabled: boolean) {
  const fetchThread = useServerFn(getProjectThread);
  const fetchActivity = useServerFn(getProjectThreadActivity);
  const markRead = useServerFn(markProjectThreadRead);
  const queryClient = useQueryClient();

  const thread = useQuery({
    queryKey: ["marketplace", "project", caseId, "thread"] as const,
    queryFn: () => fetchThread({ data: { caseId } }),
    enabled,
  });

  const activity = useQuery({
    queryKey: ["marketplace", "project", caseId, "activity"] as const,
    queryFn: () => fetchActivity({ data: { caseId } }),
    enabled: enabled && thread.isSuccess,
    refetchInterval: ACTIVITY_POLL_MS,
    refetchIntervalInBackground: false,
  });

  /** Tout ce qui concerne ce projet — fil, fiche, listes — sauf la signature elle-même. */
  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (query) =>
        (query.queryKey.includes(caseId) && !query.queryKey.includes("activity")) ||
        query.queryKey.includes("cases"),
    });

  const seen = useRef<string | null>(null);
  const signature = activity.data?.signature;
  useEffect(() => {
    if (!signature) return;
    if (seen.current !== null && seen.current !== signature) void refresh();
    seen.current = signature;
    // `refresh` ne dépend que de caseId et du client de requêtes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const unread = thread.data?.unread ?? 0;
  useEffect(() => {
    if (!enabled || unread === 0) return;
    void markRead({ data: { caseId } }).then(() => refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, unread, caseId]);

  return { thread, refresh };
}
