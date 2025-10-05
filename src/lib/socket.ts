type MinimalSocket = {
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string, cb: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
};

let socketInstance: MinimalSocket | null = null;

export function getProjectsSocket(): MinimalSocket {
  if (socketInstance) return socketInstance;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  // Use require to avoid TS module resolution issues during linting
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { io } = require('socket.io-client');
  const client = io(`${baseUrl}/projects`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    timeout: 20000,
    forceNew: true,
  });
  // Basic diagnostics to surface connection issues
  client.on('connect', () => {
    // no-op: successful connection
  });
  client.on('connect_error', (err: any) => {
    // eslint-disable-next-line no-console
    console.error('[projects-socket] connect_error:', err?.message || err);
  });
  client.on('error', (err: any) => {
    // eslint-disable-next-line no-console
    console.error('[projects-socket] error:', err?.message || err);
  });
  socketInstance = client as MinimalSocket;
  return socketInstance as MinimalSocket;
}
