import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

/**
 * Browser client — use inside Client Components.
 */
export function createBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Server client bound to the request cookies — use in Server Components,
 * Route Handlers, and Server Actions where auth session matters.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore, middleware refreshes sessions.
        }
      },
    },
  });
}

/** Client-side deadline for every service-role request (connect + query). */
const SERVICE_TIMEOUT_MS = 10_000;

/**
 * Service-role client for trusted server-side data fetching.
 * Bypasses RLS — never import this into a Client Component.
 */
export function createServiceSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (input, init) => {
        const deadline = AbortSignal.timeout(SERVICE_TIMEOUT_MS);
        const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
        return fetch(input, { ...init, signal });
      },
    },
  });
}
