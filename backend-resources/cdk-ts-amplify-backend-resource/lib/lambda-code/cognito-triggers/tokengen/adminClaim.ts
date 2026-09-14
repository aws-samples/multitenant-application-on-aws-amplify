/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

interface DynamoDbStringAttribute {
  S?: string;
}

export type AdminRecord = Record<string, DynamoDbStringAttribute> | undefined;

export function getAuthoritativeAdminClaim(item: AdminRecord): 'true' | 'false' {
  return item?.isAdmin?.S === 'true' ? 'true' : 'false';
}

interface ClaimsOverrideDetails {
  claimsToAddOrOverride?: Record<string, string>;
  [key: string]: unknown;
}

export function withAuthoritativeAdminClaim(
  existing: ClaimsOverrideDetails | undefined,
  item: AdminRecord
): ClaimsOverrideDetails {
  return {
    ...existing,
    claimsToAddOrOverride: {
      ...existing?.claimsToAddOrOverride,
      'custom:isAdmin': getAuthoritativeAdminClaim(item),
    },
  };
}
