'use client';

import { APIProvider } from './api/common';

export function Providers({ children }: { children: React.ReactNode }) {
  return <APIProvider>{children}</APIProvider>;
}
