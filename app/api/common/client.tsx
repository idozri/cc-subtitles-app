import axios from 'axios';

// Client-side axios instance with interceptors
export const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  withCredentials: true,
});

// Only add interceptors on the client side
if (typeof window !== 'undefined') {
  // Import client-side dependencies only in browser
  const { useUserStore } = require('@/lib/store/user');

  // Request interceptor: with HTTP-only cookies, no need to manually attach tokens
  client.interceptors.request.use(async (config) => {
    // No manual token attachment needed - cookies are sent automatically
    return config;
  });

  // Response interceptor: handle 401 and refresh token
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      debugger;
      // Prevent infinite loop and avoid refreshing on auth endpoints
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/refresh') &&
        !originalRequest.url?.includes('/auth/login')
      ) {
        originalRequest._retry = true;

        try {
          // Attempt to refresh token using our API route
          const refreshResponse = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshResponse.ok) {
            // Retry original request with updated cookies
            return client(originalRequest);
          } else {
            throw new Error('Refresh failed');
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // If refresh fails, clear user and redirect to login
          useUserStore.getState().clearUser();
          if (typeof window !== 'undefined') {
            // Preserve current path for redirect after login
            const currentPath = window.location.pathname;
            const redirectParam =
              currentPath !== '/'
                ? `?redirect=${currentPath.substring(1)}`
                : '';
            window.location.href = `/login${redirectParam}`;
          }
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
}
