import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createHandler } from "./handler.ts";

const config = {
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  supabaseKey: Deno.env.get("SUPABASE_ANON_KEY"),
  allowedOrigins: Deno.env.get("ALLOWED_ORIGINS"),
};
// getUser verifies each bearer token; RPCs use that token, never a service-role client.
Deno.serve(createHandler(config, (authorization) => {
  const client = createClient(config.supabaseUrl!, config.supabaseKey!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async getUser() {
      const { data, error } = await client.auth.getUser();
      return {
        authenticated: !error && !!data.user,
        anonymous: data.user?.is_anonymous ?? false,
      };
    },
    async rpc(name, args) {
      return client.rpc(name, args);
    },
  };
}));
