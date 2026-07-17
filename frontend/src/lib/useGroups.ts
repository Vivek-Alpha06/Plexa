import { useCallback, useEffect, useState } from "react";
import { factory, group } from "./contracts";
import { CONFIGURED } from "./config";
import type { GroupView } from "../types";

/** Loads every group's config/state/members from the factory registry. */
export function useGroups() {
  const [views, setViews] = useState<GroupView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!CONFIGURED) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ids = await factory.getAllGroups();
      const loaded = await Promise.all(
        ids.map(async (id) => {
          const g = group(id);
          const [config, state, members] = await Promise.all([
            g.getConfig(),
            g.getState(),
            g.getMembers(),
          ]);
          return { id, config, state, members } as GroupView;
        })
      );
      setViews(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { views, loading, error, reload: load };
}
