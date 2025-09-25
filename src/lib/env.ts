export const Env = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const;
