# Authentication System Implementation Plan

**Version:** 1.0
**Last Updated:** 2026-02-17
**Reference:** The Graph's wallet-first authentication flow

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication Flow](#2-authentication-flow)
3. [Backend Implementation](#3-backend-implementation)
4. [Frontend Implementation](#4-frontend-implementation)
5. [Database Schema](#5-database-schema)
6. [API Endpoints](#6-api-endpoints)
7. [Token Management](#7-token-management)
8. [Email Verification](#8-email-verification)
9. [Settings & Profile](#9-settings--profile)
10. [Migration from Current State](#10-migration-from-current-state)

---

## 1. Overview

### Current State

- Backend has JWT + API key auth infrastructure (`core/guards/`, `modules/auth/`)
- Frontend has wallet connection via `@reown/appkit` + Wagmi
- No actual user accounts, sessions, or persistent authentication
- "Connect Wallet" button exists in the navbar but doesn't create accounts
- All data is publicly accessible

### Target State

- Wallet-based authentication (similar to The Graph)
- Sign-in with Ethereum (SIWE / message signing)
- JWT tokens for session management
- Optional email collection with verification
- Persistent user accounts in a separate user database
- Settings/profile section for managing account

### Design Decisions

1. **Wallet is the primary identifier** - No username/password
2. **Remove "Connect Wallet" from website** - Replace with "Get Started" button that routes to dashboard
3. **Auth flows happen on the dashboard** - Not on the marketing site
4. **Email is optional** - But we nudge users to add it
5. **The backend NEVER writes to the analytics database** - User data goes to a separate database

---

## 2. Authentication Flow

### 2.1 Primary Flow: Wallet Sign-In

```
User clicks "Get Started" (web) or "Connect Wallet" (dashboard)
    │
    ▼
Step 1: Wallet Connection
    │   User selects wallet provider (MetaMask, WalletConnect, etc.)
    │   Wagmi/AppKit handles the connection
    │   We receive the user's wallet address
    │
    ▼
Step 2: Message Signing (SIWE)
    │   Backend generates a nonce + challenge message
    │   Frontend presents the message for signing
    │   User signs the message in their wallet
    │   Frontend sends signature + message to backend
    │
    ▼
Step 3: Verification & Token Issuance
    │   Backend verifies the signature matches the wallet address
    │   Backend creates or retrieves the user record
    │   Backend issues JWT access token + refresh token
    │   Frontend stores tokens (httpOnly cookie for refresh, memory for access)
    │
    ▼
Step 4: Optional Email Collection
    │   Modal asks: "Add your email for notifications?"
    │   User can skip or enter email
    │   If entered → 6-digit verification code sent
    │   User enters code → email verified
    │
    ▼
Step 5: Authenticated Session
    │   All subsequent API calls include the JWT access token
    │   Backend identifies user tier (free/pro) from token
    │   Data is returned based on user's access level
```

### 2.2 Returning User Flow

```
User visits dashboard
    │
    ▼
Check: Valid refresh token in cookie?
    │
    ├── YES → Silent token refresh → Authenticated session
    │
    └── NO → Show "Connect Wallet" in dashboard header
              User connects wallet → Same flow as above (steps 1-3)
              Step 4 skipped if email already on file
```

### 2.3 Email Nudge Flow

For users who skipped email during sign-up:

```
Trigger Points:
  - Banner at top of dashboard: "Add your email for alerts"
  - Settings page: Email section highlighted
  - After first week: Toast notification nudge
  - Before Pro upgrade: Email required for billing

User clicks "Add Email"
    │
    ▼
Email input modal
    │
    ▼
6-digit code sent to email
    │
    ▼
User enters code → Email verified → Stored
```

---

## 3. Backend Implementation

### 3.1 Existing Infrastructure to Leverage

The backend already has:

| Component | File | Status |
|-----------|------|--------|
| Auth module | `src/modules/auth/auth.module.ts` | Exists, needs expansion |
| Auth controller | `src/modules/auth/auth.controller.ts` | Exists, needs expansion |
| Auth service | `src/modules/auth/auth.service.ts` | Exists, needs expansion |
| JWT strategy | `src/modules/auth/jwt.strategy.ts` | Exists, needs update |
| Signature verification | `src/modules/auth/signature-verification.service.ts` | Exists (ethers.js) |
| JWT guard | `src/core/guards/jwt-auth.guard.ts` | Exists |
| API key guard | `src/core/guards/api-key.guard.ts` | Exists |
| Roles guard | `src/core/guards/roles.guard.ts` | Exists |
| Public decorator | `src/core/decorators/public.decorator.ts` | Exists |

### 3.2 New Services Required

| Service | Purpose |
|---------|---------|
| `UserService` | CRUD for user accounts (on user DB) |
| `NonceService` | Generate/validate SIWE nonces |
| `EmailService` | Send verification codes, marketing emails |
| `TokenService` | JWT access/refresh token management |
| `SubscriptionService` | Manage pro/free tier status |

### 3.3 Auth Flow - Backend Steps

**Step 1: Generate Nonce**
```
POST /api/v1/auth/nonce
Body: { wallet_address: "0x..." }
Response: { nonce: "abc123", message: "Sign this message to verify..." }
```

**Step 2: Verify Signature**
```
POST /api/v1/auth/verify
Body: { wallet_address: "0x...", signature: "0x...", message: "..." }
Response: {
  access_token: "jwt...",
  refresh_token: "jwt...",
  user: { wallet_address, email, tier, ... },
  is_new_user: true/false
}
```

**Step 3: Token Refresh**
```
POST /api/v1/auth/refresh
Cookie: refresh_token=jwt...
Response: { access_token: "new_jwt..." }
```

### 3.4 Signature Verification (SIWE)

The existing `signature-verification.service.ts` uses `ethers.js` (v6, already installed). The flow:

```typescript
// Simplified verification logic
import { verifyMessage } from 'ethers';

const SIWE_MESSAGE_TEMPLATE = (address: string, nonce: string, domain: string) =>
  `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to EigenWatch\n\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

// Verify
const recoveredAddress = verifyMessage(message, signature);
if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
  throw new UnauthorizedException('Invalid signature');
}
```

### 3.5 JWT Token Strategy

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| **Access Token** | 15 minutes | Memory (frontend) | API authentication |
| **Refresh Token** | 7 days | httpOnly cookie | Silent token refresh |
| **Nonce** | 5 minutes | Redis | SIWE challenge (one-time use) |

**Access Token Payload:**
```json
{
  "sub": "user_id",
  "wallet_address": "0x...",
  "tier": "free|pro",
  "iat": 1234567890,
  "exp": 1234568790
}
```

---

## 4. Frontend Implementation

### 4.1 Changes to Web App (`apps/web`)

| Change | Details |
|--------|---------|
| Remove "Connect Wallet" from navbar | Replace with "Get Started" button |
| "Get Started" button | Routes to `dashboard.eigenwatch.xyz` (or the auth flow there) |
| Remove `/auth/connect` page | No longer needed on the marketing site |
| Keep wallet provider | Needed for reading wallet state if user is connected |

### 4.2 Changes to Dashboard App (`apps/dashboard`)

| Change | Details |
|--------|---------|
| Add auth state management | Zustand store for user session |
| Add auth modal/flow | Multi-step modal (connect → sign → email) |
| Add token management | Access token in memory, refresh in cookie |
| Add authenticated API calls | Attach Bearer token to all requests |
| Add email nudge banner | Conditional banner for users without email |
| Add settings/profile page | New route: `/settings` |

### 4.3 Auth Store (Zustand)

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;

  // Actions
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
}
```

### 4.4 Auth Modal Component

A multi-step modal that handles the full flow:

```
Step 1: "Connect Your Wallet"
  - Wallet provider selection (via AppKit)
  - Security badges

Step 2: "Verify Your Identity"
  - Message preview
  - "Sign Message" button
  - Loading state during signing

Step 3: "Stay Updated" (Optional)
  - Email input
  - Checkboxes: [ ] Marketing emails, [ ] Security alerts
  - "Skip for Now" link
  - "Continue" button

Step 4: "Verify Your Email" (if email entered)
  - 6-digit code input
  - "Resend Code" link
  - Auto-advance on valid code
```

### 4.5 Protected Routes

Add a middleware or layout wrapper for authenticated routes:

```typescript
// middleware.ts (dashboard app root)
export function middleware(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token');

  // Public routes that don't need auth
  const publicPaths = ['/'];

  if (!refreshToken && !publicPaths.includes(request.nextUrl.pathname)) {
    // Don't redirect - show auth modal overlay instead
    // Handle this in the layout component
  }
}
```

> **Note:** We don't hard-redirect unauthenticated users. We show the dashboard with the auth modal as an overlay, so they can see what they're signing up for.

---

## 5. Database Schema

### 5.1 User Database (NEW - separate from analytics DB)

This is a new PostgreSQL database that the backend writes to. The analytics DB remains read-only for the backend.

```prisma
// prisma/user-schema.prisma (new Prisma schema for user DB)

model users {
  id                String   @id @default(uuid())
  wallet_address    String   @unique
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  last_login_at     DateTime?

  // Profile
  display_name      String?
  avatar_url        String?

  // Subscription
  tier              UserTier  @default(FREE)
  tier_expires_at   DateTime?
  stripe_customer_id String?

  // Relations
  emails            user_emails[]
  sessions          user_sessions[]
  preferences       user_preferences?
  watchlist         user_watchlist[]
  nonces            auth_nonces[]
}

model user_emails {
  id                String   @id @default(uuid())
  user_id           String
  email             String
  is_primary        Boolean  @default(false)
  is_verified       Boolean  @default(false)
  verified_at       DateTime?
  created_at        DateTime @default(now())

  // Preferences
  marketing_opt_in  Boolean  @default(false)
  alerts_opt_in     Boolean  @default(true)

  user              users    @relation(fields: [user_id], references: [id])

  @@unique([user_id, email])
}

model user_sessions {
  id                String   @id @default(uuid())
  user_id           String
  refresh_token_hash String
  device_info       String?
  ip_address        String?
  created_at        DateTime @default(now())
  expires_at        DateTime
  revoked_at        DateTime?

  user              users    @relation(fields: [user_id], references: [id])
}

model auth_nonces {
  id                String   @id @default(uuid())
  wallet_address    String
  nonce             String   @unique
  message           String
  created_at        DateTime @default(now())
  expires_at        DateTime
  used              Boolean  @default(false)

  user              users?   @relation(fields: [wallet_address], references: [wallet_address])
}

model email_verification_codes {
  id                String   @id @default(uuid())
  email             String
  code              String
  created_at        DateTime @default(now())
  expires_at        DateTime
  used              Boolean  @default(false)
  attempts          Int      @default(0)
}

model user_preferences {
  id                String   @id @default(uuid())
  user_id           String   @unique
  theme             String   @default("dark")
  default_currency  String   @default("USD")
  notification_frequency String @default("daily")
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  user              users    @relation(fields: [user_id], references: [id])
}

model user_watchlist {
  id                String   @id @default(uuid())
  user_id           String
  entity_type       String   // "operator" | "avs" | "strategy"
  entity_id         String
  created_at        DateTime @default(now())
  alert_enabled     Boolean  @default(false)

  user              users    @relation(fields: [user_id], references: [id])

  @@unique([user_id, entity_type, entity_id])
}

enum UserTier {
  FREE
  PRO
  ENTERPRISE
}
```

### 5.2 Multi-Database Prisma Setup

The backend needs two Prisma clients:

1. **Analytics Prisma Client** (existing) - READ-ONLY access to the analytics/pipeline DB
2. **User Prisma Client** (new) - READ-WRITE access to the user DB

```typescript
// src/core/database/prisma-analytics.service.ts (rename existing)
// src/core/database/prisma-user.service.ts (new)
```

See the **Backend Database Separation** document for detailed implementation.

---

## 6. API Endpoints

### 6.1 Auth Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/auth/nonce` | Public | Generate SIWE nonce |
| POST | `/api/v1/auth/verify` | Public | Verify signature, issue tokens |
| POST | `/api/v1/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/v1/auth/logout` | JWT | Revoke session |
| GET | `/api/v1/auth/me` | JWT | Get current user profile |

### 6.2 Email Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/auth/email/add` | JWT | Initiate email addition |
| POST | `/api/v1/auth/email/verify` | JWT | Verify email with code |
| DELETE | `/api/v1/auth/email/:id` | JWT | Remove email |
| PUT | `/api/v1/auth/email/:id/primary` | JWT | Set as primary email |
| PUT | `/api/v1/auth/email/:id/preferences` | JWT | Update email preferences |

### 6.3 User/Settings Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| PUT | `/api/v1/users/me/profile` | JWT | Update display name, avatar |
| GET | `/api/v1/users/me/preferences` | JWT | Get user preferences |
| PUT | `/api/v1/users/me/preferences` | JWT | Update preferences |
| GET | `/api/v1/users/me/sessions` | JWT | List active sessions |
| DELETE | `/api/v1/users/me/sessions/:id` | JWT | Revoke specific session |
| GET | `/api/v1/users/me/watchlist` | JWT | Get watchlist |
| POST | `/api/v1/users/me/watchlist` | JWT | Add to watchlist |
| DELETE | `/api/v1/users/me/watchlist/:id` | JWT | Remove from watchlist |

---

## 7. Token Management

### 7.1 Access Token

- **Type:** JWT (Bearer token)
- **Lifetime:** 15 minutes
- **Storage:** In-memory (Zustand store on frontend)
- **Transmission:** `Authorization: Bearer <token>` header
- **Payload:** `{ sub, wallet_address, tier, iat, exp }`
- **Signing:** HMAC-SHA256 with `JWT_SECRET` env variable

### 7.2 Refresh Token

- **Type:** JWT (opaque to frontend)
- **Lifetime:** 7 days
- **Storage:** httpOnly, Secure, SameSite=Strict cookie
- **Transmission:** Automatic via cookie on `/api/v1/auth/refresh`
- **Rotation:** New refresh token issued on each refresh (old one revoked)
- **Payload:** `{ sub, session_id, iat, exp }`

### 7.3 Token Refresh Strategy (Frontend)

```typescript
// lib/auth/token-refresh.ts
let refreshPromise: Promise<string> | null = null;

export async function getValidAccessToken(authStore: AuthState): Promise<string> {
  const { accessToken, refreshToken: doRefresh } = authStore;

  if (accessToken && !isTokenExpired(accessToken)) {
    return accessToken;
  }

  // Deduplicate concurrent refresh requests
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}
```

### 7.4 Axios Interceptor (Dashboard)

```typescript
// lib/api.ts - add auth interceptor
api.interceptors.request.use(async (config) => {
  const token = await getValidAccessToken(useAuthStore.getState());
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired during request - try refresh
      try {
        await useAuthStore.getState().refreshToken();
        return api(error.config); // Retry original request
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 8. Email Verification

### 8.1 Code Generation

- 6-digit numeric code
- Valid for 10 minutes
- Maximum 3 attempts per code
- Maximum 5 codes per email per hour (rate limit)
- Codes stored hashed in `email_verification_codes` table

### 8.2 Email Service

Use a transactional email provider (e.g., Resend, SendGrid, or AWS SES):

```typescript
@Injectable()
export class EmailService {
  async sendVerificationCode(email: string, code: string): Promise<void> {
    // Send via provider
  }

  async sendWelcomeEmail(email: string, displayName?: string): Promise<void> {
    // Send after email verification
  }
}
```

### 8.3 Email Templates

Minimal, branded templates:
- Verification code email
- Welcome email (after verification)
- Pro upgrade confirmation
- Security alert (new device login)

---

## 9. Settings & Profile

### 9.1 New Dashboard Route: `/settings`

```
/settings
├── /settings/profile      # Display name, avatar, wallet
├── /settings/emails       # Manage emails, preferences
├── /settings/sessions     # Active sessions, revoke
├── /settings/preferences  # Theme, currency, notifications
└── /settings/subscription # Current tier, upgrade CTA
```

### 9.2 Profile Section

- Display wallet address (with copy button)
- Optional display name
- Optional avatar (upload or generate from wallet address)
- Account creation date

### 9.3 Email Management

- List all emails (primary, secondary)
- Add new email
- Remove email
- Set primary email
- Toggle marketing opt-in per email
- Toggle alert opt-in per email

### 9.4 Session Management

- List active sessions (device, IP, last active)
- Revoke individual sessions
- "Revoke All Other Sessions" button

---

## 10. Migration from Current State

### 10.1 Phase 1: Backend Auth Infrastructure

1. Set up the user database (separate Prisma schema)
2. Expand `auth.module.ts` with nonce, verify, refresh endpoints
3. Create `UserService` with the user DB Prisma client
4. Update `JwtAuthGuard` to validate against user DB
5. Add `@Public()` decorator to all existing analytics endpoints (backward compatible)
6. Test auth flow with Postman/curl

### 10.2 Phase 2: Frontend Auth Flow

1. Remove "Connect Wallet" from web app navbar → replace with "Get Started"
2. Create auth Zustand store in dashboard
3. Build auth modal (connect → sign → email)
4. Add token management (interceptors, refresh)
5. Add authenticated state to navbar (show wallet address + avatar)
6. Test full flow end-to-end

### 10.3 Phase 3: Email & Settings

1. Integrate email provider (Resend recommended)
2. Build email verification flow
3. Build `/settings` pages
4. Add email nudge banner for users without email
5. Test email flows

### 10.4 Phase 4: Data Gating

See **Pro vs Free Feature Gating** document for gating existing endpoints.

### 10.5 Backward Compatibility

During migration:
- All analytics endpoints remain accessible with the existing API key
- JWT auth is additive - if no Bearer token is present and API key is valid, treat as anonymous/free user
- This allows the frontend to be updated incrementally

---

## Implementation Priority

| Priority | Task | Effort |
|----------|------|--------|
| P0 | User database schema + Prisma setup | 1 day |
| P0 | Auth endpoints (nonce, verify, refresh) | 2 days |
| P0 | Frontend auth modal + wallet flow | 2 days |
| P1 | Token management + API interceptors | 1 day |
| P1 | Email verification flow | 1-2 days |
| P1 | Settings page (basic) | 1 day |
| P2 | Email nudge system | 0.5 day |
| P2 | Session management UI | 0.5 day |
| P2 | Welcome/security email templates | 1 day |
