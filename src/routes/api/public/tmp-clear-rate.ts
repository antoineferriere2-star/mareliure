import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-clear-rate")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { error, count } = await supabaseAdmin
          .from("build_runtime_rate")
          .delete({ count: "exact" })
          .gte("created_at", since);
        return new Response(JSON.stringify({ count, error }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
