# Issue: Pro Users Receiving FREE Tier Data (Auth Token Not Forwarded)

**Date Discovered:** 2026-02-23
**Status:** Fixed
**Severity:** Critical
**Affected:** All gated API endpoints for authenticated pro users on the dashboard

---

## Summary

Pro users visiting the operator dashboard were receiving FREE tier data with gated fields. All API responses returned `"user_tier":"FREE"` despite the user having a valid PRO subscription. The root cause was that the Next.js server action (`handleApiAction`) was not forwarding the JWT access token to the backend — only the `x-api-key` header was sent.

---

## Symptoms

API responses for authenticated PRO users returned:

```json
{
  "success": true,
  "data": {
    "user_tier": "FREE",
    "strategies": [
      {
        "strategy_id": "...",
        "strategy_name": "...",
        "strategy_symbol": "UNKNOWN",
        "max_magnitude": "UPGRADE_REQUIRED",
        "encumbered_magnitude": "UPGRADE_REQUIRED",
        "available_magnitude": "UPGRADE_REQUIRED"
      }
    ]
  }
}
```

Gated fields showed `"UPGRADE_REQUIRED"` placeholders instead of real data.

---

## Root Cause Analysis

### Auth Flow (Before Fix)

```
Browser (client) → Next.js Server Action (handleApiAction) → Backend API
                   ↑                                          ↑
                   Only sends x-api-key                       JwtAuthGuard sees no token
                   Does NOT send JWT Bearer token             → user = null
                                                              → tier defaults to "FREE"
```

### Detailed Breakdown

1. **Frontend `auth-api.ts`** — The `authFetch()` wrapper properly sends JWT Bearer tokens but is only used for auth-specific endpoints (login, email, sessions, etc.)

2. **Frontend `handleApiAction.ts`** — Used for all dashboard data endpoints (strategies, AVS, delegators, commissions, allocations). Uses the `api.ts` axios client which only includes `x-api-key` in headers. **No JWT token was sent.**

3. **Backend `JwtAuthGuard`** — Global guard with optional auth. If no Authorization header is present, it returns `null` for the user (does not reject the request).

4. **Backend Controllers** — Default to `tier = user?.tier ?? "FREE"` when user is null. This is correct behavior — the bug was on the frontend.

5. **Cookie state** — The `setAuthCookie()` / `getAccessToken()` / `clearAuthCookie()` server actions existed in `actions/utils.ts` but were never called. The access token was stored in Zustand client-side state only, inaccessible from server actions.

### Key Code Paths

- `eigenwatch-frontend/apps/dashboard/lib/api.ts` — Axios instance with only `x-api-key`
- `eigenwatch-frontend/apps/dashboard/lib/handleApiAction.ts` — Server action, had no auth token logic
- `eigenwatch-frontend/apps/dashboard/lib/auth-api.ts` — Client-side fetch with proper JWT, but only for auth endpoints
- `eigenwatch-frontend/apps/dashboard/actions/utils.ts` — Cookie helpers existed but were unwired
- `backend/src/core/guards/jwt-auth.guard.ts` — Optional JWT guard, returns null if no token
- `backend/src/modules/auth/jwt.strategy.ts` — Extracts user + tier from DB via JWT

---

## Fix Applied

### 1. `handleApiAction.ts` — Forward JWT from httpOnly cookie

```typescript
"use server";

import api from "@/lib/api";
import { handleSuccess, handleError } from "@/lib/utils";
import { ApiResponse, AppApiResponse } from "@/types/api.types";
import { getAccessToken } from "@/actions/utils";

export async function handleApiAction<T = any>({
  endpoint,
  method = "post",
  body,
  successMessage,
}: ApiActionOptions): Promise<AppApiResponse<ApiResponse<T>>> {
  try {
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response =
      method === "get"
        ? await api.get(endpoint, { headers })
        : await api[method](endpoint, body, { headers });
    // ... rest unchanged
  }
}
```

### 2. `SignStep.tsx` — Sync token to cookie on login

```typescript
import { setAuthCookie } from "@/actions/utils";

// In handleSign():
setAccessToken(data.tokens.access_token);
await setAuthCookie(data.tokens.access_token);  // ← Added
setUser(data.user);
```

### 3. `auth-api.ts` — Sync cookie on refresh and clear on logout

```typescript
import { setAuthCookie, clearAuthCookie } from "@/actions/utils";

// In doRefresh():
useAuthStore.getState().setAccessToken(data.tokens.access_token);
await setAuthCookie(data.tokens.access_token);  // ← Added

// On refresh failure:
useAuthStore.getState().logout();
await clearAuthCookie();  // ← Added

// In logout():
finally {
  useAuthStore.getState().logout();
  await clearAuthCookie();  // ← Added
}
```

### Auth Flow (After Fix)

```
Browser (client) → Next.js Server Action (handleApiAction) → Backend API
                   ↑                                          ↑
                   Reads JWT from httpOnly cookie              JwtAuthGuard extracts user
                   Sends as Authorization: Bearer <token>     → user.tier = "PRO"
                                                              → Full data returned
```

---

## Verification

After the fix, API responses correctly returned:

```json
{
  "success": true,
  "data": {
    "user_tier": "PRO",
    "strategies": [
      {
        "strategy_id": "...",
        "strategy_name": "stETH",
        "strategy_symbol": "stETH",
        "max_magnitude": "7956325268382",
        "encumbered_magnitude": "7956325268382",
        "tvs_usd": "1220298215.38"
      }
    ]
  }
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `eigenwatch-frontend/apps/dashboard/lib/handleApiAction.ts` | Read access token from cookie, add Authorization header |
| `eigenwatch-frontend/apps/dashboard/components/auth/SignStep.tsx` | Call `setAuthCookie()` after login |
| `eigenwatch-frontend/apps/dashboard/lib/auth-api.ts` | Call `setAuthCookie()` on refresh, `clearAuthCookie()` on failure/logout |

---

## Prevention

- All future server actions that call the backend API should use `handleApiAction` which now handles auth forwarding
- The cookie-based approach ensures the JWT is available server-side (server actions cannot access Zustand client state)
- The httpOnly cookie has a 22-hour maxAge, matching the access token TTL
