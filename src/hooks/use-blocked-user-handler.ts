import { useEffect, useState } from 'react';
import { signOut } from '@/lib/auth';

export function useBlockedUserHandler() {
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  useEffect(() => {
    const handleUserBlocked = () => {
      setShowBlockedModal(true);
    };

    window.addEventListener('user-blocked', handleUserBlocked);

    return () => {
      window.removeEventListener('user-blocked', handleUserBlocked);
    };
  }, []);

  const handleAcknowledge = async () => {
    setShowBlockedModal(false);
    await signOut();
  };

  return { showBlockedModal, handleAcknowledge };
}
