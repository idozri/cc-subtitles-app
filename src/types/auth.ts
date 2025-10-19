export enum AUTH_ERROR_CODES {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  ACCOUNT_NOT_APPROVED = 'ACCOUNT_NOT_APPROVED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  USER_BLOCKED = 'USER_BLOCKED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface User {
  _id: string; // Changed from 'id' to '_id' to match backend
  email: string;
  firstName?: string;
  lastName?: string;
  isBlocked?: boolean;
  roles?: string[]; // Changed from 'role' to 'roles' to match backend
  companyId?: string; // Added to match backend
  emailVerified?: boolean; // Added to match backend
  createdAt?: string; // Added to match backend
  updatedAt?: string; // Added to match backend
}
