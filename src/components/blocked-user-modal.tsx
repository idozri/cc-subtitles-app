import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface BlockedUserModalProps {
  isOpen: boolean;
  onAcknowledge: () => void;
}

export function BlockedUserModal({
  isOpen,
  onAcknowledge,
}: BlockedUserModalProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Account Blocked</AlertDialogTitle>
          <AlertDialogDescription>
            Your account needs to be reactivated. Please contact support for
            assistance.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAcknowledge}>
            Understood
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
