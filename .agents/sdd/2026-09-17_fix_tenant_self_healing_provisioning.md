# SDD: Tenant Self-Healing Provisioning (Tier 2)

## Summary
Implement atomic self-healing tenant provisioning for pre-existing Supabase Auth users who lack records in `public.users` and `public.tenant_memberships`, preventing unexpected 403 Forbidden errors during login and ledger access.
Acceptance criteria: Any authenticated user without existing tenant memberships is automatically provisioned with a user record, a default personal tenant, and an `OWNER` membership upon auth callback or first API access to `/api/ledger`.

## Tasks
1. **Create Self-Healing Provisioner** — `src/core/tenancy/provisioning.ts`
   - Implement and export `ensureUserDefaultTenant(user: { id: string; email?: string; user_metadata?: Record<string, any> })`:
     - Query `tenantMemberships` for `user.id`. If memberships exist, return default membership `tenantId` or first membership `tenantId`.
     - If no memberships exist, execute atomic transaction (`db.transaction`):
       * Upsert `public.users` (id, email, fullName, avatarUrl) on conflict with primary key `id`.
       * Insert default personal tenant in `public.tenants` (name: `"Espacio Personal de " + name`, slug: `"workspace-" + user.id.slice(0, 8)`).
       * Insert membership in `public.tenant_memberships` (`userId`, `tenantId`, `role: 'OWNER'`, `isDefault: true`).
     - Return the resolved/created `tenantId`.
   - Verify: `npx vitest run tests/unit/tenancy-provisioning.test.ts`

2. **Integrate Self-Healing into Auth Callback** — `src/lib/auth/callback.ts`
   - Update `handleAuthCallback` to invoke `ensureUserDefaultTenant` (or allow dependency-injected provisioning function) when resolving `defaultTenantId` for `data.session.user`.
   - Ensure the `active_tenant_id` cookie is properly set with the newly provisioned tenant when users log in for the first time without prior database enrollment.
   - Verify: `npx vitest run tests/integration/auth-callback.test.ts`

3. **Integrate Self-Healing Fallback in Ledger Route Handler** — `src/core/ledger/handler.ts`
   - Update `LedgerRouteDependencies` interface with optional `ensureUserTenant?: (user: { id: string; email?: string }) => Promise<string | null>`.
   - In `handleGetLedger`: when `memberships.length === 0`, invoke self-healing fallback (`deps?.ensureUserTenant ? await deps.ensureUserTenant(user) : await ensureUserDefaultTenant(user)`).
   - If provisioning returns a valid tenant, populate active membership with role `OWNER` and proceed with query execution instead of terminating with 403.
   - If provisioning fails or yields null, retain existing 403 error response (`{ error: "No perteneces a ninguna organización o empresa" }`).
   - Verify: `npx vitest run tests/integration/ledger-route.test.ts`

4. **Unit & Integration Verification Suite** — `tests/unit/tenancy-provisioning.test.ts`, `tests/integration/ledger-route.test.ts`, `tests/integration/auth-callback.test.ts`
   - Create unit tests in `tests/unit/tenancy-provisioning.test.ts` verifying idempotency (returns existing tenant when present) and atomic provisioning (user upsert, tenant creation, owner membership).
   - Update `tests/integration/ledger-route.test.ts` to test self-healing on empty memberships and preservation of 403 when self-healing returns null.
   - Update `tests/integration/auth-callback.test.ts` to verify cookie setting on newly provisioned user.
   - Verify: `npm run test` and `npm run typecheck`

## Verification
- `npx vitest run tests/unit/tenancy-provisioning.test.ts tests/integration/auth-callback.test.ts tests/integration/ledger-route.test.ts` (All unit & integration tests pass with 100% green status)
- `npm run typecheck` (TypeScript compiles with 0 errors)
- `npm run test` (Full test suite passes without regression)
