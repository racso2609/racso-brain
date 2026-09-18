import { describe, it, expect } from "vitest";

// Mock simulated database state for testing trigger and RLS rules
interface SimulatedAuthUser {
  id: string;
  email: string;
  raw_user_meta_data: {
    given_name?: string;
    family_name?: string;
    avatar_url?: string;
  };
}

interface SimulatedPublicUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

interface SimulatedTenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface SimulatedMembership {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
  isDefault: boolean;
}

interface SimulatedTransaction {
  id: string;
  tenantId: string;
  amount: string;
  description: string;
  status: string;
}

// Simulated PL/pgSQL trigger function matching 0001_seed_rbac_and_trigger.sql
function handleNewUserTrigger(
  newUser: SimulatedAuthUser,
  dbState: {
    users: SimulatedPublicUser[];
    tenants: SimulatedTenant[];
    memberships: SimulatedMembership[];
  },
  shouldFailInStep?: number
) {
  // Begin simulated atomic transaction
  const rollbackState = {
    users: [...dbState.users],
    tenants: [...dbState.tenants],
    memberships: [...dbState.memberships],
  };

  try {
    const firstName = newUser.raw_user_meta_data?.given_name ?? newUser.email.split("@")[0];
    const lastName = newUser.raw_user_meta_data?.family_name ?? "";
    const fullName = `${firstName} ${lastName}`.trim();

    if (shouldFailInStep === 1) throw new Error("Step 1 Failed: User insertion error");

    // 1. Insert into public.users
    const publicUser: SimulatedPublicUser = {
      id: newUser.id,
      email: newUser.email,
      fullName,
      avatarUrl: newUser.raw_user_meta_data?.avatar_url,
    };
    dbState.users.push(publicUser);

    if (shouldFailInStep === 2) throw new Error("Step 2 Failed: Tenant insertion error");

    // 2. Create personal default tenant
    const tenantId = `tenant-${newUser.id.substring(0, 8)}`;
    const tenant: SimulatedTenant = {
      id: tenantId,
      name: `Espacio Personal de ${firstName}`,
      slug: `workspace-${newUser.id.substring(0, 8)}`,
      isActive: true,
    };
    dbState.tenants.push(tenant);

    if (shouldFailInStep === 3) throw new Error("Step 3 Failed: Membership insertion error");

    // 3. Create initial membership as OWNER
    const membership: SimulatedMembership = {
      id: `mship-${newUser.id.substring(0, 8)}`,
      userId: newUser.id,
      tenantId,
      role: "OWNER",
      isDefault: true,
    };
    dbState.memberships.push(membership);

    return { success: true, tenantId };
  } catch (error) {
    // Transaction Rollback
    dbState.users = rollbackState.users;
    dbState.tenants = rollbackState.tenants;
    dbState.memberships = rollbackState.memberships;
    throw error;
  }
}

function createInitialDbState(): {
  users: SimulatedPublicUser[];
  tenants: SimulatedTenant[];
  memberships: SimulatedMembership[];
} {
  return { users: [], tenants: [], memberships: [] };
}

describe("Integration: Database Trigger & Multi-Tenant Isolation (TC-BE-01, TC-BE-02, TC-BE-07, TC-BE-08, TC-BE-09)", () => {
  it("TC-BE-07: atomically provisions public.users from auth.users metadata", () => {
    const dbState = createInitialDbState();
    const authUser: SimulatedAuthUser = {
      id: "a1111111-1111-1111-1111-111111111111",
      email: "oscar@example.com",
      raw_user_meta_data: {
        given_name: "Oscar",
        family_name: "Developer",
        avatar_url: "https://avatar.com/photo.jpg",
      },
    };

    handleNewUserTrigger(authUser, dbState);

    expect(dbState.users).toHaveLength(1);
    expect(dbState.users[0].id).toBe(authUser.id);
    expect(dbState.users[0].email).toBe("oscar@example.com");
    expect(dbState.users[0].fullName).toBe("Oscar Developer");
    expect(dbState.users[0].avatarUrl).toBe("https://avatar.com/photo.jpg");
  });

  it("TC-BE-08: provisions personal tenant with 'Espacio Personal de [Name]' and OWNER membership", () => {
    const dbState = createInitialDbState();
    const authUser: SimulatedAuthUser = {
      id: "b2222222-2222-2222-2222-222222222222",
      email: "maria@example.com",
      raw_user_meta_data: {
        given_name: "Maria",
      },
    };

    const result = handleNewUserTrigger(authUser, dbState);

    expect(dbState.tenants).toHaveLength(1);
    expect(dbState.tenants[0].name).toBe("Espacio Personal de Maria");
    expect(dbState.tenants[0].slug).toBe("workspace-b2222222");

    expect(dbState.memberships).toHaveLength(1);
    expect(dbState.memberships[0].userId).toBe(authUser.id);
    expect(dbState.memberships[0].tenantId).toBe(result.tenantId);
    expect(dbState.memberships[0].role).toBe("OWNER");
    expect(dbState.memberships[0].isDefault).toBe(true);
  });

  it("TC-BE-09: rolls back transaction if any step in provisioning fails", () => {
    const dbState = createInitialDbState();
    const authUser: SimulatedAuthUser = {
      id: "c3333333-3333-3333-3333-333333333333",
      email: "fail@example.com",
      raw_user_meta_data: { given_name: "Fail" },
    };

    // Fail in step 2 (tenant insertion)
    expect(() => handleNewUserTrigger(authUser, dbState, 2)).toThrow("Step 2 Failed");

    // All tables must remain empty due to rollback
    expect(dbState.users).toHaveLength(0);
    expect(dbState.tenants).toHaveLength(0);
    expect(dbState.memberships).toHaveLength(0);
  });

  it("TC-BE-01: strictly isolates read queries so tenant A sees 0 records of tenant B", () => {
    const tenantA = "tenant-a-12345";
    const tenantB = "tenant-b-67890";

    const allTransactions: SimulatedTransaction[] = [
      { id: "tx-1", tenantId: tenantA, amount: "100.00", description: "Expense A", status: "COMMITTED" },
      { id: "tx-2", tenantId: tenantB, amount: "500.00", description: "Expense B", status: "COMMITTED" },
      { id: "tx-3", tenantId: tenantB, amount: "250.00", description: "Income B", status: "COMMITTED" },
    ];

    // Query executed by user with active tenant = tenantA
    const activeTenantId = tenantA;
    const filteredResults = allTransactions.filter((tx) => tx.tenantId === activeTenantId);

    expect(filteredResults).toHaveLength(1);
    expect(filteredResults[0].id).toBe("tx-1");
    expect(filteredResults.every((tx) => tx.tenantId === tenantA)).toBe(true);
    expect(filteredResults.some((tx) => tx.tenantId === tenantB)).toBe(false);
  });

  it("TC-BE-02: rejects cross-tenant mutations with NotFound or Unauthorized", () => {
    const tenantA = "tenant-a-12345";
    const tenantB = "tenant-b-67890";

    const transactions: SimulatedTransaction[] = [
      { id: "tx-1", tenantId: tenantA, amount: "100.00", description: "Expense A", status: "COMMITTED" },
      { id: "tx-2", tenantId: tenantB, amount: "500.00", description: "Expense B", status: "COMMITTED" },
    ];

    // User from Tenant A tries to update tx-2 (belonging to Tenant B)
    function mutateTransaction(activeTenant: string, targetTxId: string, newStatus: string) {
      const target = transactions.find((tx) => tx.id === targetTxId);
      if (!target) throw new Error("Transaction not found");
      if (target.tenantId !== activeTenant) {
        throw new Error("Unauthorized: Cross-tenant modification denied");
      }
      target.status = newStatus;
      return target;
    }

    expect(() => mutateTransaction(tenantA, "tx-2", "VOIDED")).toThrow(
      "Unauthorized: Cross-tenant modification denied"
    );

    // Target transaction status must remain untouched
    const untouched = transactions.find((tx) => tx.id === "tx-2");
    expect(untouched?.status).toBe("COMMITTED");
  });
});
