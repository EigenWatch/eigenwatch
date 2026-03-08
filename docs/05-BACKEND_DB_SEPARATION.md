# Backend Database Separation Plan

**Version:** 1.0
**Last Updated:** 2026-02-17
**Constraint:** The backend MUST NOT write to the analytics database. That database is controlled by the pipeline.

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Target Architecture](#2-target-architecture)
3. [Multi-Database Prisma Setup](#3-multi-database-prisma-setup)
4. [Service Layer Changes](#4-service-layer-changes)
5. [Environment Configuration](#5-environment-configuration)
6. [Migration & Deployment](#6-migration--deployment)

---

## 1. Current State

### 1.1 Single Database

The backend currently connects to **one PostgreSQL database** via a single Prisma client:

```
Backend (NestJS)
    │
    └── PrismaService (single client)
         │
         └── PostgreSQL: eigenlayer_analytics
              ├── operators, operator_state, operator_analytics, ...
              ├── avs, strategies, stakers, ...
              ├── pipeline_checkpoints, pipeline_sync_status, ...
              └── (50+ tables - ALL pipeline-managed)
```

### 1.2 Current Prisma Setup

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Single schema for analytics DB |
| `prisma.config.ts` | Config pointing to `DATABASE_URL` |
| `src/core/database/prisma.module.ts` | Global Prisma module |
| `src/core/database/prisma.service.ts` | Single Prisma service |

### 1.3 The Problem

The backend needs to **write user data** (accounts, sessions, preferences, watchlist) but the analytics database is pipeline-controlled and the backend should never write to it.

---

## 2. Target Architecture

### 2.1 Two Databases

```
Backend (NestJS)
    │
    ├── PrismaAnalyticsService (READ-ONLY)
    │    │
    │    └── PostgreSQL: eigenlayer_analytics
    │         ├── operators, operator_state, ...
    │         └── (pipeline-managed, backend reads only)
    │
    └── PrismaUserService (READ-WRITE)
         │
         └── PostgreSQL: eigenwatch_users
              ├── users, user_emails, user_sessions, ...
              ├── auth_nonces, email_verification_codes, ...
              ├── user_preferences, user_watchlist, ...
              └── (backend-managed, backend reads and writes)
```

### 2.2 Principles

1. **Analytics DB is READ-ONLY for the backend** - No inserts, updates, or deletes
2. **User DB is owned by the backend** - Full CRUD access
3. **Two separate Prisma schemas** - Different generators, different clients
4. **Two separate database URLs** - Different connection strings in env
5. **Existing code changes minimally** - Rename `PrismaService` → `PrismaAnalyticsService`

---

## 3. Multi-Database Prisma Setup

### 3.1 Directory Structure

```
prisma/
├── analytics/
│   ├── schema.prisma          # Existing schema (renamed/moved)
│   └── migrations/            # Managed by pipeline, not backend
│
└── user/
    ├── schema.prisma          # New user schema
    └── migrations/            # Managed by backend
```

### 3.2 Analytics Schema (`prisma/analytics/schema.prisma`)

This is the existing `prisma/schema.prisma` moved to its own directory. No changes to the schema content.

```prisma
// prisma/analytics/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../node_modules/.prisma/analytics-client"
}

datasource db {
  provider = "postgresql"
  url      = env("ANALYTICS_DATABASE_URL")
}

// ... all existing models unchanged ...
```

Key change: The `output` path is unique (`analytics-client`) so it doesn't conflict with the user client.

### 3.3 User Schema (`prisma/user/schema.prisma`)

```prisma
// prisma/user/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../node_modules/.prisma/user-client"
}

datasource db {
  provider = "postgresql"
  url      = env("USER_DATABASE_URL")
}

model users {
  id                String    @id @default(uuid())
  wallet_address    String    @unique
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  last_login_at     DateTime?

  display_name      String?
  avatar_url        String?

  tier              UserTier  @default(FREE)
  tier_expires_at   DateTime?
  stripe_customer_id String?

  emails            user_emails[]
  sessions          user_sessions[]
  preferences       user_preferences?
  watchlist         user_watchlist[]
  nonces            auth_nonces[]
}

model user_emails {
  id                String    @id @default(uuid())
  user_id           String
  email             String
  is_primary        Boolean   @default(false)
  is_verified       Boolean   @default(false)
  verified_at       DateTime?
  created_at        DateTime  @default(now())

  marketing_opt_in  Boolean   @default(false)
  alerts_opt_in     Boolean   @default(true)

  user              users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, email])
  @@index([email])
}

model user_sessions {
  id                  String    @id @default(uuid())
  user_id             String
  refresh_token_hash  String
  device_info         String?
  ip_address          String?
  created_at          DateTime  @default(now())
  expires_at          DateTime
  revoked_at          DateTime?

  user                users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([refresh_token_hash])
}

model auth_nonces {
  id              String    @id @default(uuid())
  wallet_address  String
  nonce           String    @unique
  message         String
  created_at      DateTime  @default(now())
  expires_at      DateTime
  used            Boolean   @default(false)

  user            users?    @relation(fields: [wallet_address], references: [wallet_address])

  @@index([wallet_address])
  @@index([expires_at])
}

model email_verification_codes {
  id          String    @id @default(uuid())
  email       String
  code        String
  created_at  DateTime  @default(now())
  expires_at  DateTime
  used        Boolean   @default(false)
  attempts    Int       @default(0)

  @@index([email, code])
  @@index([expires_at])
}

model user_preferences {
  id                      String    @id @default(uuid())
  user_id                 String    @unique
  theme                   String    @default("dark")
  default_currency        String    @default("USD")
  notification_frequency  String    @default("daily")
  created_at              DateTime  @default(now())
  updated_at              DateTime  @updatedAt

  user                    users     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}

model user_watchlist {
  id            String    @id @default(uuid())
  user_id       String
  entity_type   String    // "operator" | "avs" | "strategy"
  entity_id     String
  created_at    DateTime  @default(now())
  alert_enabled Boolean   @default(false)

  user          users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, entity_type, entity_id])
  @@index([user_id])
}

enum UserTier {
  FREE
  PRO
  ENTERPRISE
}
```

### 3.4 Generate Commands

```bash
# Generate analytics client
npx prisma generate --schema=prisma/analytics/schema.prisma

# Generate user client
npx prisma generate --schema=prisma/user/schema.prisma

# Run migrations on user DB only (never on analytics DB)
npx prisma migrate dev --schema=prisma/user/schema.prisma

# Introspect analytics DB (pull latest schema from pipeline)
npx prisma db pull --schema=prisma/analytics/schema.prisma
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "prisma:generate": "prisma generate --schema=prisma/analytics/schema.prisma && prisma generate --schema=prisma/user/schema.prisma",
    "prisma:migrate:user": "prisma migrate dev --schema=prisma/user/schema.prisma",
    "prisma:pull:analytics": "prisma db pull --schema=prisma/analytics/schema.prisma"
  }
}
```

---

## 4. Service Layer Changes

### 4.1 Two Prisma Services

**Analytics (rename existing):**

```typescript
// src/core/database/prisma-analytics.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '.prisma/analytics-client';

@Injectable()
export class PrismaAnalyticsService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**User (new):**

```typescript
// src/core/database/prisma-user.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '.prisma/user-client';

@Injectable()
export class PrismaUserService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 4.2 Updated Database Module

```typescript
// src/core/database/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaAnalyticsService } from './prisma-analytics.service';
import { PrismaUserService } from './prisma-user.service';

@Global()
@Module({
  providers: [PrismaAnalyticsService, PrismaUserService],
  exports: [PrismaAnalyticsService, PrismaUserService],
})
export class PrismaModule {}
```

### 4.3 Updating Existing Repositories

All existing repositories currently inject `PrismaService`. Rename to `PrismaAnalyticsService`:

```typescript
// Before
constructor(protected readonly prisma: PrismaService) {}

// After
constructor(protected readonly prisma: PrismaAnalyticsService) {}
```

**Files to update:**
- `src/modules/operators/repositories/operators.repository.ts`
- `src/modules/operators/repositories/operator-strategy.repository.ts`
- `src/modules/operators/repositories/operator-delegator.repository.ts`
- `src/modules/operators/repositories/operator-avs.repository.ts`
- `src/modules/operators/repositories/operator-allocation.repository.ts`
- `src/modules/operators/repositories/operator-analytics.repository.ts`
- `src/modules/network/repositories/network.repository.ts`
- `src/modules/strategies/repositories/strategies.repository.ts`
- `src/modules/search/repositories/search.repository.ts`
- `src/core/common/base.repository.ts`

### 4.4 New User Repositories

```typescript
// src/modules/auth/repositories/user.repository.ts
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  async findByWalletAddress(address: string) {
    return this.prisma.users.findUnique({
      where: { wallet_address: address.toLowerCase() },
      include: { emails: true, preferences: true },
    });
  }

  async create(walletAddress: string) {
    return this.prisma.users.create({
      data: { wallet_address: walletAddress.toLowerCase() },
    });
  }

  async findOrCreate(walletAddress: string) {
    const existing = await this.findByWalletAddress(walletAddress);
    if (existing) return { user: existing, isNew: false };
    const user = await this.create(walletAddress);
    return { user, isNew: true };
  }

  // ... more methods
}
```

```typescript
// src/modules/auth/repositories/session.repository.ts
@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  async create(data: { userId: string; refreshTokenHash: string; expiresAt: Date; deviceInfo?: string; ipAddress?: string }) {
    return this.prisma.user_sessions.create({
      data: {
        user_id: data.userId,
        refresh_token_hash: data.refreshTokenHash,
        expires_at: data.expiresAt,
        device_info: data.deviceInfo,
        ip_address: data.ipAddress,
      },
    });
  }

  async findByTokenHash(hash: string) {
    return this.prisma.user_sessions.findFirst({
      where: { refresh_token_hash: hash, revoked_at: null },
      include: { user: true },
    });
  }

  async revoke(sessionId: string) {
    return this.prisma.user_sessions.update({
      where: { id: sessionId },
      data: { revoked_at: new Date() },
    });
  }
}
```

### 4.5 Health Check Updates

Update the health module to check both databases:

```typescript
// src/modules/health/health.service.ts
async checkDatabaseHealth() {
  const analyticsHealth = await this.checkAnalyticsDb();
  const userHealth = await this.checkUserDb();

  return {
    analytics_db: analyticsHealth,
    user_db: userHealth,
  };
}
```

---

## 5. Environment Configuration

### 5.1 Updated .env

```env
# Analytics Database (READ-ONLY for backend)
ANALYTICS_DATABASE_URL=postgresql://user:password@analytics-host:5432/eigenlayer_analytics
ANALYTICS_DATABASE_POOL_SIZE=10

# User Database (READ-WRITE for backend)
USER_DATABASE_URL=postgresql://user:password@user-host:5432/eigenwatch_users
USER_DATABASE_POOL_SIZE=5

# ... rest of env unchanged
```

### 5.2 Updated Config Service

```typescript
// src/core/config/env.validation.ts - add new env vars
export const envSchema = {
  // Rename existing
  ANALYTICS_DATABASE_URL: str(),
  // Add new
  USER_DATABASE_URL: str(),
  // ... rest unchanged
};
```

### 5.3 Backward Compatibility

During migration, support the old `DATABASE_URL` as a fallback:

```typescript
const analyticsUrl = process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL;
```

---

## 6. Migration & Deployment

### 6.1 Step-by-Step Migration

**Step 1: Create the user database**
```bash
# Create the database (on the database server)
createdb eigenwatch_users

# Or via psql
psql -c "CREATE DATABASE eigenwatch_users;"
```

**Step 2: Set up Prisma schemas**
```bash
# Move existing schema
mkdir -p prisma/analytics prisma/user
mv prisma/schema.prisma prisma/analytics/schema.prisma

# Update the generator output in analytics schema
# Update the datasource URL env name

# Create user schema
# (Write the user schema as specified in section 3.3)

# Generate both clients
npm run prisma:generate
```

**Step 3: Run user DB migrations**
```bash
npx prisma migrate dev --schema=prisma/user/schema.prisma --name init
```

**Step 4: Update codebase**
```bash
# 1. Create PrismaAnalyticsService (rename existing PrismaService)
# 2. Create PrismaUserService
# 3. Update PrismaModule exports
# 4. Update all repository imports
# 5. Create user repositories
# 6. Update env validation
```

**Step 5: Update Docker**

```dockerfile
# Dockerfile - update prisma generate step
RUN npx prisma generate --schema=prisma/analytics/schema.prisma && \
    npx prisma generate --schema=prisma/user/schema.prisma
```

```bash
# start.sh - update to handle both schemas
npx prisma migrate deploy --schema=prisma/user/schema.prisma
node dist/main.js
```

**Step 6: Deploy**
- Set both `ANALYTICS_DATABASE_URL` and `USER_DATABASE_URL` in production env
- Deploy new code
- Verify health check passes for both databases

### 6.2 Rollback Plan

If something goes wrong:
1. The analytics database is unchanged (no writes ever happened)
2. The user database can be dropped and recreated
3. Rename `PrismaAnalyticsService` back to `PrismaService` to revert

### 6.3 Database Hosting Options

The user database can be:
- **Same server, different database** (simplest)
- **Same managed instance, different database** (e.g., same RDS instance)
- **Separate managed instance** (if scaling separately)

For initial deployment, same server/different database is recommended.

---

## Appendix: File Change Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Move to `prisma/analytics/schema.prisma` |
| `prisma/user/schema.prisma` | NEW - user database schema |
| `prisma.config.ts` | Update or remove (use CLI flags instead) |
| `src/core/database/prisma.service.ts` | Rename to `prisma-analytics.service.ts` |
| `src/core/database/prisma-user.service.ts` | NEW |
| `src/core/database/prisma.module.ts` | Export both services |
| `src/modules/*/repositories/*.ts` | Change `PrismaService` → `PrismaAnalyticsService` |
| `src/core/common/base.repository.ts` | Change `PrismaService` → `PrismaAnalyticsService` |
| `src/modules/auth/repositories/` | NEW - user.repository.ts, session.repository.ts, etc. |
| `src/core/config/env.validation.ts` | Add `USER_DATABASE_URL` |
| `.env.example` | Add `USER_DATABASE_URL`, rename `DATABASE_URL` |
| `Dockerfile` | Update prisma generate commands |
| `start.sh` | Add user DB migration |
| `package.json` | Add prisma scripts for both schemas |
