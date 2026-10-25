"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export interface LoginState {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
  needsSignup?: boolean;
  fields?: { email: string; name: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sends a magic link. People who already have an account only need their email;
// first-timers also give a display name and the group's invite code.
// Sign-ups are disabled in Supabase, so this action is the only way in.
export async function requestLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const code = String(formData.get("code") ?? "").trim();
  const fields = { email, name };
  const fail = (message: string, needsSignup = false): LoginState => ({ status: "error", message, fields, needsSignup });

  if (!EMAIL_RE.test(email)) return fail("That email looks incomplete. Check it and try again.");

  const admin = createAdminClient();
  const { data: registered, error: lookupError } = await admin.rpc("email_is_registered", { p_email: email });
  if (lookupError) return fail("We could not reach the login service. Try again in a minute.");

  if (!registered) {
    if (!name || !code) {
      return fail("First time here? Add the name the group knows you by and the invite code from the group chat.", true);
    }
    if (name.length > 40) return fail("Keep your display name under 40 characters.", true);
    if (code.toLowerCase() !== env.inviteCode().toLowerCase()) {
      return fail("That invite code does not match. Ask for the current code in the group chat.", true);
    }
    const { data: nameStatus } = await admin.rpc("display_name_status", { p_name: name });
    if (nameStatus === "taken") {
      return fail(`Someone in the group already uses "${name}". Add an initial, like "${name} B."`, true);
    }
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (createError) return fail("We could not create your account. Try again, or ask an admin.", true);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${env.siteUrl()}/auth/confirm?next=/` },
  });
  if (error) {
    if (error.status === 429) return fail("Too many login emails in a short time. Wait a few minutes and try again.");
    return fail("We could not send the login email. Try again in a minute.");
  }
  return { status: "sent", email };
}
