# Supabase RLS Authentication Guide

## Your Current Setup: Vite + React

Your project uses Vite + React, so you don't need middleware.ts in the Next.js sense. Instead, I've updated your `supabaseClient.js` with proper RLS handling.

### Key Features Added to supabaseClient.js:

✅ **Session Persistence** - Sessions survive page refreshes via localStorage  
✅ **Auto Token Refresh** - Invalid tokens are automatically refreshed  
✅ **URL Session Detection** - Handles email verification links  
✅ **ensureAuthSession()** - Before sensitive queries, call this to guarantee valid auth

### Usage in Your React Components:

```javascript
import { supabase, ensureAuthSession } from "@/supabaseClient";

// Option 1: Simple query with RLS protection
const { data, error } = await supabase
  .from("hardware_inventory")
  .select("*")
  .eq("user_id", user.id); // RLS checks this with current session

// Option 2: Ensure valid session before critical operations
const fetchSensitiveData = async () => {
  try {
    // This throws if no valid session exists
    const session = await ensureAuthSession();

    const { data, error } = await supabase.from("purchase_orders").select("*");

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Auth failed:", err);
    // Redirect to login
    window.location.href = "/login";
  }
};
```

### Important: RLS Policy Setup

Your Supabase RLS policies MUST check the auth context. Example:

```sql
-- Purchase Orders RLS Policy
CREATE POLICY "Users can view their own purchase orders"
ON purchase_orders
FOR SELECT
USING (auth.uid() = user_id);

-- Create Orders
CREATE POLICY "Users can create purchase orders"
ON purchase_orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update Orders
CREATE POLICY "Users can update their own orders"
ON purchase_orders
FOR UPDATE
USING (auth.uid() = user_id);
```

---

## Next.js Alternative (Reference)

If you migrate to Next.js or have a separate Next.js backend, use the `middleware.ts` file provided.

### How the Next.js Middleware Works:

1. **Intercepts all requests** - Middleware runs before route handlers
2. **Reads cookies from request** - Gets the auth session from request cookies
3. **Creates server client** - Initializes Supabase with proper cookie handling
4. **Refreshes session if needed** - Ensures tokens never expire
5. **Syncs cookies to response** - Updates cookies in the response
6. **Protects routes** - Redirects unauthenticated users to /login

### Next.js Installation (if needed):

```bash
npm install @supabase/ssr
```

Then use this in your Next.js API routes:

```typescript
// app/api/protected/route.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );

  // Session is now synced - RLS will work!
  const { data: orders } = await supabase.from("purchase_orders").select("*");

  return Response.json(orders);
}
```

---

## Troubleshooting RLS Issues

### ❌ Problem: "new row violates row level security policy"

- **Cause**: User ID not matching RLS policy
- **Fix**: Ensure you're setting the correct `user_id` with `auth.uid()`

### ❌ Problem: "PGRST301 - Insufficient privileges"

- **Cause**: Session not passed to server
- **Fix**: Call `ensureAuthSession()` before queries

### ❌ Problem: "JWT token invalid"

- **Cause**: Token expired
- **Fix**: Middleware (Next.js) or `autoRefreshToken: true` (React) handles this

### ❌ Problem: "Column does not exist"

- **Cause**: Selecting columns not allowed by RLS
- **Fix**: Make sure column permissions are correct

---

## Environment Variables

Make sure you have in your `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# For Next.js
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Security Best Practices

1. **Always use RLS policies** - Never disable them in production
2. **Never expose the service role key** to the browser - Only use anon key + RLS
3. **Call ensureAuthSession()** - For sensitive operations that require auth
4. **Set proper JWT expiry** - Supabase defaults to 1 hour (configurable)
5. **Handle token refresh** - Middleware and `autoRefreshToken` do this automatically

---

## Quick Checklist

- [ ] supabaseClient.js updated with session persistence
- [ ] RLS policies created for all tables
- [ ] ensureAuthSession() used before sensitive queries
- [ ] .env file has correct Supabase credentials
- [ ] autoRefreshToken is enabled (it is by default)
- [ ] Tested login/logout flow
- [ ] Tested that users can only see their own data
