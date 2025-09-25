export interface PaginateQuery<T> {
  results: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  next: string | null;
  previous: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    company?: {
      id: string;
      name: string;
    };
  };
  // Tokens are handled by HTTP-only cookies, not returned in response
  tokens?: {
    access: string;
    refresh: string;
  };
}
