# API Endpoint & Access Token Guard Implementation Plan

**Version:** 1.0
**Last Updated:** 2026-02-17
**Dependencies:** Authentication System (02), Pro/Free Gating (03), Database Separation (05)

---

## Table of Contents

1. [Current API State](#1-current-api-state)
2. [Access Token Integration](#2-access-token-integration)
3. [Endpoint Rewrites](#3-endpoint-rewrites)
4. [Guard Architecture](#4-guard-architecture)
5. [Rate Limiting by Tier](#5-rate-limiting-by-tier)
6. [Implementation Plan](#6-implementation-plan)

---

## 1. Current API State

### 1.1 Current Auth Flow

```
Request → API Key Guard (x-api-key header)
    │
    ├── Valid key → Allow request
    └── Invalid/missing key → 401 Unauthorized
```

All endpoints use the same API key. There's no user-level authentication on data endpoints.

### 1.2 Current Guards (Applied Globally in `main.ts`)

| Guard | Purpose | Status |
|-------|---------|--------|
| `ApiKeyGuard` | Validates `x-api-key` header | Active |
| `JwtAuthGuard` | Validates Bearer token | Exists but not enforced on data endpoints |
| `RolesGuard` | Role-based access | Exists but unused |

### 1.3 Current Decorators

| Decorator | Purpose |
|-----------|---------|
| `@Public()` | Skip all auth (health endpoints) |
| `@SkipApiKey()` | Skip API key check |

### 1.4 Current Response Format

All endpoints return:
```json
{
  "success": true,
  "message": "...",
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "timestamp": "iso",
    "execution_time_ms": 42
  },
  "pagination": { ... }
}
```

---

## 2. Access Token Integration

### 2.1 New Auth Flow

```
Request → API Key Guard → JWT Auth Guard (optional) → Tier Guard → Controller
    │           │                │                         │
    │           │                │                         ├── Check tier_context
    │           │                │                         └── Filter response
    │           │                │
    │           │                ├── Bearer token present → Validate → Set req.user
    │           │                └── No token → Set req.user = null (anonymous)
    │           │
    │           ├── Valid API key → Continue
    │           └── Invalid → 401
    │
    └── @Public() → Skip everything
```

### 2.2 Three Access Levels

| Level | Auth | Tier | Data Access |
|-------|------|------|-------------|
| **Anonymous** | API key only, no JWT | N/A | Same as FREE |
| **Free** | API key + JWT (free tier) | FREE | Aggregates, headlines, badges |
| **Pro** | API key + JWT (pro tier) | PRO | Full detailed data |

**Key Decision:** Anonymous and Free get the same data. The distinction is that Free users have an account (can watchlist, get nudged to upgrade) while Anonymous users don't.

### 2.3 Updated JWT Strategy

```typescript
// src/modules/auth/jwt.strategy.ts - updated
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userRepository: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      wallet_address: user.wallet_address,
      tier: user.tier,
      email_verified: user.emails?.some(e => e.is_verified) ?? false,
    };
  }
}
```

### 2.4 Make JWT Optional on Data Endpoints

The current `JwtAuthGuard` should be modified to not reject requests without tokens on data endpoints:

```typescript
// src/core/guards/jwt-auth.guard.ts - updated
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // If no token provided, allow request but with no user (anonymous)
    if (info?.name === 'JsonWebTokenError' || info?.name === 'TokenExpiredError') {
      return null; // No user, treated as anonymous/free
    }
    if (err) throw err;
    return user || null;
  }
}
```

### 2.5 Auth Types

```typescript
// src/shared/types/auth.types.ts
export interface JwtPayload {
  sub: string;           // User ID
  wallet_address: string;
  tier: UserTier;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  wallet_address: string;
  tier: UserTier;
  email_verified: boolean;
}

export type UserTier = 'FREE' | 'PRO' | 'ENTERPRISE';
```

---

## 3. Endpoint Rewrites

### 3.1 Endpoints That Need Tier-Aware Responses

These endpoints return different data based on user tier (Approach A from gating doc):

| Endpoint | Free Response | Pro Response |
|----------|--------------|-------------|
| `GET /operators/:id/strategies` | Counts + distribution chart data | + Full strategy table |
| `GET /operators/:id/avs` | Counts + headline metrics | + Full AVS relationship table |
| `GET /operators/:id/delegators` | Count + HHI badge | + Full delegator list |
| `GET /operators/:id/allocations` | Utilization badges + counts | + Exact amounts + metrics |
| `GET /operators/:id/commission` | Current rate + positioning | + History + volatility + per-AVS |

### 3.2 Endpoints That Are Entirely Pro-Gated

These endpoints return 403 for free/anonymous users (Approach B):

| Endpoint | Guard |
|----------|-------|
| `GET /operators/:id/risk` | `@TierGated('pro')` |
| `GET /operators/:id/concentration` | `@TierGated('pro')` |
| `GET /operators/:id/volatility` | `@TierGated('pro')` |
| `GET /operators/:id/rankings` | `@TierGated('pro')` |
| `POST /operators/compare` | `@TierGated('pro')` |

### 3.3 Endpoints That Remain Fully Public

These endpoints serve the same data regardless of tier:

| Endpoint | Notes |
|----------|-------|
| `GET /operators` | Operator listing (free discovery) |
| `GET /operators/:id` | Operator overview |
| `GET /operators/:id/stats` | Basic statistics |
| `GET /operators/:id/activity` | Activity timeline |
| `GET /operators/:id/snapshots/daily` | Chart data |
| `GET /network/*` | All network endpoints |
| `GET /search/*` | All search endpoints |
| `GET /strategies/*` | All strategy listing endpoints |
| `GET /health/*` | All health endpoints |

### 3.4 Controller Pattern for Tier-Aware Endpoints

```typescript
// operators.controller.ts - example pattern
@Get(':id/delegators')
async getDelegators(
  @Param('id') operatorId: string,
  @Query() params: ListDelegatorsDto,
  @Req() request: Request,
) {
  const user: AuthUser | null = request.user as AuthUser | null;
  const tier = user?.tier ?? 'FREE';

  return this.operatorService.getOperatorDelegators(operatorId, params, tier);
}

@Get(':id/risk')
@TierGated('pro')  // Entire endpoint gated
async getRiskAssessment(@Param('id') operatorId: string) {
  return this.operatorService.getRiskAssessment(operatorId);
}
```

### 3.5 Service Pattern for Filtered Responses

```typescript
// operators.service.ts - tier-aware method
async getOperatorDelegators(
  operatorId: string,
  params: ListDelegatorsDto,
  tier: UserTier,
): Promise<DelegatorTabResponse> {
  // Always fetch summary (cheap query)
  const summary = await this.delegatorRepo.getSummary(operatorId);

  const freeData = {
    total_delegators: summary.total,
    delegation_hhi_label: summary.hhiLabel,
    delegation_hhi_description: this.getHHIDescription(summary.hhiLabel),
  };

  if (tier === 'FREE') {
    return {
      ...freeData,
      delegator_list: null,
      tier_context: {
        user_tier: 'free',
        gated_fields: ['delegator_list'],
        upgrade_message: 'Unlock individual delegator data with EigenWatch Pro',
      },
    };
  }

  // Pro: fetch full list
  const delegators = await this.delegatorRepo.findMany(operatorId, params);
  const pagination = await this.delegatorRepo.count(operatorId, params);

  return {
    ...freeData,
    delegator_list: delegators,
    pagination,
    tier_context: {
      user_tier: 'pro',
      gated_fields: [],
    },
  };
}
```

---

## 4. Guard Architecture

### 4.1 Guard Execution Order

Guards execute in a specific order. The new setup:

```
1. ApiKeyGuard      → Validates x-api-key (existing)
2. JwtAuthGuard     → Extracts user from Bearer token (optional)
3. TierGuard        → Checks if user tier meets endpoint requirement
```

### 4.2 Register Guards Globally

```typescript
// main.ts
app.useGlobalGuards(
  new ApiKeyGuard(reflector),
  new JwtAuthGuard(reflector),
  new TierGuard(reflector),
);
```

### 4.3 Decorator Combinations

| Decorator | Behavior |
|-----------|----------|
| `@Public()` | Skip API key + JWT + Tier (health endpoints) |
| `@SkipApiKey()` | Skip API key only |
| `@TierGated('pro')` | Require Pro tier (403 otherwise) |
| (none) | API key required, JWT optional, tier check in service |

### 4.4 Custom Decorators

```typescript
// src/core/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user ?? null;
  },
);

// Usage in controllers:
@Get(':id/delegators')
async getDelegators(
  @Param('id') operatorId: string,
  @Query() params: ListDelegatorsDto,
  @CurrentUser() user: AuthUser | null,
) {
  const tier = user?.tier ?? 'FREE';
  // ...
}
```

---

## 5. Rate Limiting by Tier

### 5.1 Rate Limit Tiers

| Tier | Requests/minute | Requests/hour |
|------|-----------------|---------------|
| Anonymous | 30 | 500 |
| Free | 60 | 1,000 |
| Pro | 300 | 10,000 |
| Enterprise | 1,000 | 50,000 |

### 5.2 Implementation

Use the existing rate limiting infrastructure but make it tier-aware:

```typescript
// src/core/rate-limiting/tier-rate-limit.guard.ts
@Injectable()
export class TierRateLimitGuard implements CanActivate {
  constructor(
    private cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | null;
    const tier = user?.tier ?? 'ANONYMOUS';

    const limits = {
      ANONYMOUS: { perMinute: 30, perHour: 500 },
      FREE: { perMinute: 60, perHour: 1000 },
      PRO: { perMinute: 300, perHour: 10000 },
      ENTERPRISE: { perMinute: 1000, perHour: 50000 },
    };

    const identifier = user?.id ?? request.ip;
    const limit = limits[tier];

    // Check minute window
    const minuteKey = `ratelimit:${identifier}:${Math.floor(Date.now() / 60000)}`;
    const minuteCount = await this.cacheService.increment(minuteKey, 60);

    if (minuteCount > limit.perMinute) {
      throw new HttpException({
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. ${tier} tier allows ${limit.perMinute} requests per minute.`,
        retry_after: 60 - (Date.now() / 1000) % 60,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
```

### 5.3 Rate Limit Headers

Include rate limit info in responses:

```typescript
// In response interceptor
response.headers['X-RateLimit-Limit'] = limit.perMinute.toString();
response.headers['X-RateLimit-Remaining'] = (limit.perMinute - minuteCount).toString();
response.headers['X-RateLimit-Reset'] = resetTime.toString();
```

---

## 6. Implementation Plan

### 6.1 Phase 1: JWT Optional on All Endpoints

**Goal:** Make JWT extraction work without breaking existing API key flow.

1. Update `JwtAuthGuard.handleRequest` to return null instead of throwing
2. Add `@CurrentUser()` decorator
3. Test: All endpoints still work with API key only
4. Test: Endpoints extract user when Bearer token provided

**Risk:** LOW - additive change, no breaking changes.

### 6.2 Phase 2: TierGuard on Pro-Only Endpoints

**Goal:** Gate pro-only endpoints.

1. Create `TierGuard` and `@TierGated()` decorator
2. Apply `@TierGated('pro')` to risk, concentration, volatility, rankings, compare endpoints
3. Test: Free users get 403 on gated endpoints
4. Test: Pro users access normally

**Risk:** LOW - only affects endpoints that are clearly pro-only.

### 6.3 Phase 3: Tier-Aware Responses on Shared Endpoints

**Goal:** Return different data based on tier.

1. Update controller methods to extract user tier
2. Update service methods to accept tier parameter
3. Implement filtered responses for: delegators, strategies, AVS, allocations, commission
4. Add `tier_context` to all responses
5. Test: Free users get aggregates only
6. Test: Pro users get full data

**Risk:** MEDIUM - modifies existing response shapes. Frontend must handle `tier_context`.

### 6.4 Phase 4: Rate Limiting by Tier

1. Implement `TierRateLimitGuard`
2. Add rate limit headers to response interceptor
3. Test with different tiers
4. Monitor in production

**Risk:** LOW - additive, can be disabled quickly.

### 6.5 Phase 5: Frontend Integration

1. Update all React Query hooks to read `tier_context`
2. Implement `ProGate` component wrappers on all gated data
3. Add upgrade CTAs
4. Test visual gating end-to-end

---

## Appendix: Complete Endpoint Access Matrix

| Endpoint | Anonymous | Free | Pro |
|----------|-----------|------|-----|
| `GET /operators` | Full | Full | Full |
| `GET /operators/:id` | Full | Full | Full |
| `GET /operators/:id/stats` | Full | Full | Full |
| `GET /operators/:id/activity` | Full | Full | Full |
| `GET /operators/:id/snapshots/daily` | Full | Full | Full |
| `GET /operators/:id/strategies` | Summary | Summary | Full |
| `GET /operators/:id/avs` | Summary | Summary | Full |
| `GET /operators/:id/delegators` | Summary | Summary | Full |
| `GET /operators/:id/allocations` | Badges | Badges | Full |
| `GET /operators/:id/commission` | Headline | Headline | Full |
| `GET /operators/:id/commission/history` | 403 | 403 | Full |
| `GET /operators/:id/risk` | 403 | 403 | Full |
| `GET /operators/:id/concentration` | 403 | 403 | Full |
| `GET /operators/:id/volatility` | 403 | 403 | Full |
| `GET /operators/:id/rankings` | 403 | 403 | Full |
| `POST /operators/compare` | 403 | 403 | Full |
| `GET /operators/:id/vs-network` | 403 | 403 | Full |
| `GET /operators/:id/slashing` | Full | Full | Full |
| `GET /network/*` | Full | Full | Full |
| `GET /search/*` | Full | Full | Full |
| `GET /strategies/*` | Full | Full | Full |
| `GET /health/*` | Full | Full | Full |
| `POST /auth/*` | Public | Public | Public |
| `GET /users/me/*` | 401 | Full | Full |
