import { db, type Database } from "@/db";
import { users, tenants, tenantMemberships } from "@/db/schema";
import { eq } from "drizzle-orm";

export type TransactionClient = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbClient = Database | TransactionClient;

export interface ProvisionableUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  raw_user_meta_data?: Record<string, unknown>;
}

export function extractUserProfile(user: ProvisionableUser) {
  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  const emailPrefix = user.email ? user.email.split("@")[0] : "Usuario";

  const givenName = typeof metadata.given_name === "string" ? metadata.given_name : null;
  const firstNameMeta = typeof metadata.first_name === "string" ? metadata.first_name : null;
  const fullNameMeta = typeof metadata.full_name === "string" ? metadata.full_name : null;
  const familyName = typeof metadata.family_name === "string" ? metadata.family_name : null;
  const lastNameMeta = typeof metadata.last_name === "string" ? metadata.last_name : null;
  const avatarUrlMeta = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;
  const pictureMeta = typeof metadata.picture === "string" ? metadata.picture : null;

  const firstName =
    givenName ||
    firstNameMeta ||
    (fullNameMeta ? fullNameMeta.split(" ")[0] : null) ||
    emailPrefix ||
    "Usuario";
  const lastName = familyName || lastNameMeta || "";
  const fullName =
    fullNameMeta ||
    `${firstName} ${lastName}`.trim() ||
    emailPrefix ||
    "Usuario";
  const avatarUrl = avatarUrlMeta || pictureMeta || null;
  const email = user.email || `${user.id}@placeholder.local`;

  return { firstName, lastName, fullName, avatarUrl, email };
}

/**
 * Ensures that a Supabase Auth user has a corresponding record in public.users,
 * a default personal tenant, and an OWNER tenant_membership.
 * If the user already has memberships, returns the default (or first) tenant ID.
 */
export async function ensureUserDefaultTenant(
  user: ProvisionableUser,
  dbInstance: DbClient = db
): Promise<string> {
  // 1. Check if memberships already exist for this user
  const existingMemberships = await dbInstance
    .select({
      tenantId: tenantMemberships.tenantId,
      isDefault: tenantMemberships.isDefault,
    })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.userId, user.id));

  if (existingMemberships && existingMemberships.length > 0) {
    const defaultMembership = existingMemberships.find(
      (m: { isDefault?: boolean }) => m.isDefault
    );
    return defaultMembership?.tenantId ?? existingMemberships[0].tenantId;
  }

  // 2. Perform atomic self-healing provisioning
  const runTransaction = async (cb: (tx: DbClient) => Promise<string>): Promise<string> => {
    if ("transaction" in dbInstance && typeof dbInstance.transaction === "function") {
      return await (
        dbInstance.transaction as (txCb: (tx: TransactionClient) => Promise<string>) => Promise<string>
      )(cb);
    }
    return await cb(dbInstance);
  };

  return await runTransaction(async (tx: DbClient) => {
    // Re-check within transaction to prevent race conditions
    const innerMemberships = await tx
      .select({
        tenantId: tenantMemberships.tenantId,
        isDefault: tenantMemberships.isDefault,
      })
      .from(tenantMemberships)
      .where(eq(tenantMemberships.userId, user.id));

    if (innerMemberships && innerMemberships.length > 0) {
      const defaultMembership = innerMemberships.find(
        (m: { isDefault?: boolean }) => m.isDefault
      );
      return defaultMembership?.tenantId ?? innerMemberships[0].tenantId;
    }

    const { firstName, fullName, avatarUrl, email } = extractUserProfile(user);

    // Upsert public.users on conflict with primary key id
    await tx
      .insert(users)
      .values({
        id: user.id,
        email: email.slice(0, 255),
        fullName: fullName.slice(0, 255),
        avatarUrl,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          fullName: fullName.slice(0, 255),
          avatarUrl,
          updatedAt: new Date(),
        },
      });

    // Check slug collision fallback
    let slug = `workspace-${user.id.slice(0, 8).toLowerCase()}`.slice(0, 255);
    const existingTenant = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (existingTenant && existingTenant.length > 0) {
      slug = `workspace-${user.id.replace(/-/g, "").slice(0, 12).toLowerCase()}`.slice(0, 255);
    }

    const tenantName = `Espacio Personal de ${firstName}`.slice(0, 255);

    // Insert default personal tenant
    const insertResult = await tx
      .insert(tenants)
      .values({
        name: tenantName,
        slug: slug.slice(0, 255),
        isActive: true,
      })
      .returning({ id: tenants.id });

    const tenantId = insertResult[0]?.id;
    if (!tenantId) {
      throw new Error("Failed to provision default personal tenant");
    }

    // Insert owner membership
    await tx.insert(tenantMemberships).values({
      userId: user.id,
      tenantId,
      role: "OWNER",
      isDefault: true,
    });

    return tenantId;
  });
}
