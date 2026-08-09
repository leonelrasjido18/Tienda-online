import type { StaffRole } from '@tienda/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: StaffRole;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: StaffRole;
}
