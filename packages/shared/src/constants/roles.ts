export const STAFF_ROLES = ['OWNER', 'STAFF'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
