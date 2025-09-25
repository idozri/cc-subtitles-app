import { useEffect } from 'react';
import { useUserStore } from '@/lib/store/user';
import { client } from '@/api/common/client';

export const useAuth = () => {
  const { user, isAuthenticated, setUser, setLoading } = useUserStore();

  useEffect(() => {
    const checkAuthStatus = async () => {
      // Only check if we don't already have a user
      if (!user && !isAuthenticated) {
        setLoading(true);
        try {
          // Check if user is authenticated by calling /auth/me
          const response = await client.get('/auth/me');
          if (response.data?.success && response.data?.data) {
            setUser(response.data.data);
          }
        } catch (error) {
          // User is not authenticated or token is invalid
          // This is expected for unauthenticated users
          console.log('User not authenticated');
        } finally {
          setLoading(false);
        }
      }
    };

    checkAuthStatus();
  }, [user, isAuthenticated, setUser, setLoading]);

  return {
    user,
    isAuthenticated,
    isLoading: useUserStore((state) => state.isLoading),
  };
};
