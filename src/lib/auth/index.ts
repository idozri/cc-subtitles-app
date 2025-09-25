import { useUserStore } from '@/lib/store/user';

export const signOut = async () => {
  console.log('signOut called');
  try {
    // Call logout API endpoint to clear server-side cookies
    console.log('Making logout request...');
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include', // Ensure cookies are sent with the request
    });
    console.log('Logout response:', response);

    if (!response.ok) {
      console.error(
        'Logout request failed:',
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear user from store
    console.log('Clearing user from store...');
    useUserStore.getState().clearUser();

    // Redirect to login page
    if (typeof window !== 'undefined') {
      console.log('Redirecting to login...');
      window.location.href = '/login';
    }
  }
};
