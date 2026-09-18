-- =================================================================
-- 1. Enable Row Level Security on all core tables
-- =================================================================
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tenant_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."financial_transactions" ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- 2. Define RLS Policies for Tenant Isolation
-- =================================================================

-- Users can read their own profile
CREATE POLICY "users_self_read_policy" ON "public"."users"
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_self_update_policy" ON "public"."users"
  FOR UPDATE
  USING (id = auth.uid());

-- Tenants isolation policy (members can access their tenants)
CREATE POLICY "tenants_isolation_policy" ON "public"."tenants"
  FOR ALL
  USING (
    id IN (
      SELECT tm.tenant_id
      FROM "public"."tenant_memberships" tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Tenant memberships isolation
CREATE POLICY "memberships_isolation_policy" ON "public"."tenant_memberships"
  FOR ALL
  USING (
    user_id = auth.uid() OR
    tenant_id IN (
      SELECT tm.tenant_id
      FROM "public"."tenant_memberships" tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('OWNER', 'ADMIN')
    )
  );

-- Financial transactions isolation (strict anti-cross-tenant leakage)
CREATE POLICY "financial_tx_tenant_isolation" ON "public"."financial_transactions"
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM "public"."tenant_memberships" tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Audit logs isolation
CREATE POLICY "audit_logs_tenant_isolation" ON "public"."audit_logs"
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM "public"."tenant_memberships" tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Roles and permissions read policy (system roles or tenant roles)
CREATE POLICY "roles_isolation_policy" ON "public"."roles"
  FOR SELECT
  USING (
    tenant_id IS NULL OR
    tenant_id IN (
      SELECT tm.tenant_id
      FROM "public"."tenant_memberships" tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "permissions_read_policy" ON "public"."permissions"
  FOR SELECT
  USING (true);

CREATE POLICY "role_permissions_read_policy" ON "public"."role_permissions"
  FOR SELECT
  USING (true);

-- =================================================================
-- 3. Database Trigger: handle_new_user()
-- =================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_name TEXT;
    v_tenant_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'given_name', split_part(NEW.email, '@', 1));
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'family_name', '');
    v_user_name  := TRIM(v_first_name || ' ' || v_last_name);

    -- 1. Insert into public.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        avatar_url,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        v_user_name,
        NEW.raw_user_meta_data->>'avatar_url',
        NOW(),
        NOW()
    );

    -- 2. Create personal default tenant
    INSERT INTO public.tenants (
        name,
        slug,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        'Espacio Personal de ' || v_first_name,
        'workspace-' || SUBSTRING(NEW.id::TEXT, 1, 8),
        TRUE,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_tenant_id;

    -- 3. Create initial membership as OWNER
    INSERT INTO public.tenant_memberships (
        user_id,
        tenant_id,
        role,
        is_default,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        v_tenant_id,
        'OWNER',
        TRUE,
        NOW(),
        NOW()
    );

    RETURN NEW;
END;
$$;

-- Bind trigger if auth.users table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- =================================================================
-- 4. Seed Standard Permissions & System Roles
-- =================================================================

-- Standard permissions
INSERT INTO "public"."permissions" (id, code, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ledger:read', 'Ver Transacciones Ledger', 'Lectura de transacciones del libro diario'),
  ('a0000000-0000-0000-0000-000000000002', 'ledger:write', 'Crear Transacciones Ledger', 'Registro de nuevos movimientos en el ledger'),
  ('a0000000-0000-0000-0000-000000000003', 'ledger:void', 'Anular Transacciones Ledger', 'Anulación controlada de transacciones'),
  ('a0000000-0000-0000-0000-000000000004', 'projects:read', 'Ver Proyectos', 'Lectura de proyectos y tareas'),
  ('a0000000-0000-0000-0000-000000000005', 'projects:write', 'Modificar Proyectos', 'Crear y editar proyectos'),
  ('a0000000-0000-0000-0000-000000000006', 'projects:read_sensitive', 'Ver Notas Sensibles', 'Acceso a notas confidenciales de proyectos'),
  ('a0000000-0000-0000-0000-000000000007', 'assets:read', 'Ver Activos', 'Lectura de activos y órdenes de servicio'),
  ('a0000000-0000-0000-0000-000000000008', 'assets:write', 'Modificar Activos', 'Gestión de activos y mantenimientos'),
  ('a0000000-0000-0000-0000-000000000009', 'tenancy:admin', 'Administrar Organización', 'Gestión de miembros y configuración')
ON CONFLICT (code) DO NOTHING;

-- Standard System Roles (tenant_id IS NULL for system roles)
INSERT INTO "public"."roles" (id, tenant_id, code, name, description) VALUES
  ('b0000000-0000-0000-0000-000000000001', NULL, 'OWNER', 'Propietario', 'Control total de la organización y recursos'),
  ('b0000000-0000-0000-0000-000000000002', NULL, 'ADMIN', 'Administrador', 'Gestión operativa, financiera y de usuarios'),
  ('b0000000-0000-0000-0000-000000000003', NULL, 'PROJECT_MANAGER', 'Gestor de Proyectos', 'Gestión de proyectos y emisión de cobros'),
  ('b0000000-0000-0000-0000-000000000004', NULL, 'MAINTENANCE_OPERATOR', 'Operador de Mantenimiento', 'Gestión técnica de activos sin acceso financiero'),
  ('b0000000-0000-0000-0000-000000000005', NULL, 'FINANCIAL_AUDITOR', 'Auditor Financiero', 'Lectura y auditoría exclusiva de libros contables'),
  ('b0000000-0000-0000-0000-000000000006', NULL, 'MEMBER', 'Miembro Base', 'Acceso de lectura básico')
ON CONFLICT DO NOTHING;

-- Map Role Permissions
-- OWNER: all permissions
INSERT INTO "public"."role_permissions" (role_id, permission_id)
SELECT 'b0000000-0000-0000-0000-000000000001', p.id FROM "public"."permissions" p
ON CONFLICT DO NOTHING;

-- ADMIN: all except tenancy:admin transfer
INSERT INTO "public"."role_permissions" (role_id, permission_id)
SELECT 'b0000000-0000-0000-0000-000000000002', p.id FROM "public"."permissions" p
WHERE p.code IN ('ledger:read', 'ledger:write', 'ledger:void', 'projects:read', 'projects:write', 'projects:read_sensitive', 'assets:read', 'assets:write')
ON CONFLICT DO NOTHING;

-- PROJECT_MANAGER: projects:read, projects:write, ledger:read
INSERT INTO "public"."role_permissions" (role_id, permission_id)
SELECT 'b0000000-0000-0000-0000-000000000003', p.id FROM "public"."permissions" p
WHERE p.code IN ('projects:read', 'projects:write', 'ledger:read')
ON CONFLICT DO NOTHING;

-- MAINTENANCE_OPERATOR: assets:read, assets:write (NO ledger permissions)
INSERT INTO "public"."role_permissions" (role_id, permission_id)
SELECT 'b0000000-0000-0000-0000-000000000004', p.id FROM "public"."permissions" p
WHERE p.code IN ('assets:read', 'assets:write')
ON CONFLICT DO NOTHING;

-- FINANCIAL_AUDITOR: ledger:read (only read access to ledger)
INSERT INTO "public"."role_permissions" (role_id, permission_id)
SELECT 'b0000000-0000-0000-0000-000000000005', p.id FROM "public"."permissions" p
WHERE p.code IN ('ledger:read')
ON CONFLICT DO NOTHING;

-- MEMBER: projects:read, assets:read
INSERT INTO "public"."role_permissions" (role_id, permission_id)
SELECT 'b0000000-0000-0000-0000-000000000006', p.id FROM "public"."permissions" p
WHERE p.code IN ('projects:read', 'assets:read')
ON CONFLICT DO NOTHING;
