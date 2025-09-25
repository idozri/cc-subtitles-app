export interface Token {
  access: string;
  refresh: string;
}

export const getToken = async (): Promise<Token | null> => {
  // With HTTP-only cookies, we can't access tokens from client-side
  // The server will handle token validation and refresh automatically
  // We return null to indicate no client-side token access
  return null;
};

export const setToken = (token: Token): void => {
  // With HTTP-only cookies, tokens are set by the server
  // No client-side token storage needed
  console.log('Tokens should be set by server via HTTP-only cookies');
};

export const clearToken = (): void => {
  // With HTTP-only cookies, tokens are cleared by the server
  // No client-side token clearing needed
  console.log('Tokens should be cleared by server via HTTP-only cookies');
};
