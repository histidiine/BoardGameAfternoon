import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Full-access client for the few things the browser must never do itself:
// checking whether an email has an account and creating accounts for invited people.
// Never import this from a client component.
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
