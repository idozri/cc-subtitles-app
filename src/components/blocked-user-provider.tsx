'use client';

import { useBlockedUserHandler } from '@/hooks/use-blocked-user-handler';
import { BlockedUserModal } from '@/components/blocked-user-modal';

interface BlockedUserProviderProps {
  children: React.ReactNode;
}

export function BlockedUserProvider({ children }: BlockedUserProviderProps) {
  const { showBlockedModal, handleAcknowledge } = useBlockedUserHandler();

  return (
    <>
      {children}
      <BlockedUserModal
        isOpen={showBlockedModal}
        onAcknowledge={handleAcknowledge}
      />
    </>
  );
}
