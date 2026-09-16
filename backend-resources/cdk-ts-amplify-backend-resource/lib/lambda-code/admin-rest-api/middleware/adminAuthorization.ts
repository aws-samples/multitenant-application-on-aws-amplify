/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

export interface AdminAuthorization {
  isGlobalAdmin: boolean;
  tenantId?: string;
}

type Claims = Record<string, unknown> | undefined;

function getGroups(rawGroups: unknown): string[] {
  if (Array.isArray(rawGroups)) {
    return rawGroups.filter((group): group is string => typeof group === 'string');
  }

  if (typeof rawGroups !== 'string') {
    return [];
  }

  const normalized = rawGroups.trim();
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return parsed.filter((group): group is string => typeof group === 'string');
      }
    } catch {
      return normalized
        .slice(1, -1)
        .split(',')
        .map((group) => group.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
  }

  return normalized.split(',').map((group) => group.trim()).filter(Boolean);
}

export function getAdminAuthorization(
  claims: Claims,
  globalAdminGroup: string | undefined
): AdminAuthorization | undefined {
  if (!claims || !globalAdminGroup || globalAdminGroup === 'NONE') {
    return undefined;
  }

  const groups = getGroups(claims['cognito:groups']);
  const tenantId = typeof claims['custom:tenantId'] === 'string'
    ? claims['custom:tenantId']
    : undefined;

  if (groups.includes(globalAdminGroup)) {
    return { isGlobalAdmin: true, tenantId };
  }

  if (tenantId && claims['custom:isAdmin'] === 'true') {
    return { isGlobalAdmin: false, tenantId };
  }

  return undefined;
}

export function resolveAuthorizedTenant(
  authorization: AdminAuthorization,
  requestedTenant?: string
): string | undefined {
  return authorization.isGlobalAdmin ? requestedTenant : authorization.tenantId;
}

export function resolveNewUserAdminFlag(
  authorization: AdminAuthorization,
  requestedIsAdmin: unknown
): 'true' | 'false' {
  return authorization.isGlobalAdmin && requestedIsAdmin === 'true'
    ? 'true'
    : 'false';
}

export function getUserTenantId(user: {
  UserAttributes?: Array<{ Name?: string; Value?: string }>;
}): string | undefined {
  return user.UserAttributes?.find(
    (attribute) => attribute.Name === 'custom:tenantId'
  )?.Value;
}

export function filterUsersToTenant<
  T extends { Attributes?: Array<{ Name?: string; Value?: string }> }
>(users: T[] | undefined, tenantId: string): T[] {
  return (users ?? []).filter((user) =>
    user.Attributes?.some(
      (attribute) =>
        attribute.Name === 'custom:tenantId' && attribute.Value === tenantId
    )
  );
}
