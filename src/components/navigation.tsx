'use client';

import { useUserStore } from '@/lib/store/user';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Play,
  LogOut,
  User,
  Settings,
  Menu,
  Home,
  FolderOpen,
  Plus,
  Mail,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { ModeToggle } from '@/components/mode-toggle';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearUser, isLoading } = useUserStore();
  const { toast } = useToast();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Helper function to check if a link is active
  const isActiveLink = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href === '/projects/create') {
      return pathname === '/projects/create';
    }
    if (href === '/projects') {
      return pathname === '/projects';
    }
    if (href === '/contact') {
      return pathname === '/contact';
    }
    return pathname === href;
  };

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      // Use the centralized signOut function
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch('/api/users/me', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete account');
      }

      // Clear user state
      clearUser();

      // Try to clear auth cookies by calling logout endpoint (may fail if account is already deleted, but that's ok)
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (signOutError) {
        // Ignore sign out errors since account is already deleted
        console.log('Logout after deletion:', signOutError);
      }

      // Show success message
      toast({
        title: 'Account deleted',
        description: 'Your account has been successfully deleted.',
      });

      // Redirect to home page
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Delete account error:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const { firstName, lastName, email } = user;
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    return email[0].toUpperCase();
  };

  const getUserName = () => {
    if (!user) return 'User';
    const { firstName, lastName, email } = user;
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) {
      return firstName;
    }
    if (email) {
      return email.split('@')[0];
    }
    return 'User';
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/assets/logo.jpg"
                alt="CC Subtitles Logo"
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="text-xl font-bold">Subtitles</span>
            </Link>
          </div>

          {/* Centered Navigation - Desktop */}
          {user && (
            <nav className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center space-x-8">
              <Link
                href="/"
                className={`font-medium transition-colors ${
                  isActiveLink('/')
                    ? 'text-[#f50a06]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Home
              </Link>
              <Link
                href="/projects"
                className={`font-medium transition-colors ${
                  isActiveLink('/projects')
                    ? 'text-[#f50a06]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Projects
              </Link>
              <Link
                href="/projects/create"
                className={`font-medium transition-colors ${
                  isActiveLink('/projects/create')
                    ? 'text-[#f50a06]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Create
              </Link>
              <Link
                href="/contact"
                className={`font-medium transition-colors ${
                  isActiveLink('/contact')
                    ? 'text-[#f50a06]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Contact Us
              </Link>
            </nav>
          )}

          {/* Right side - User menu and mobile menu */}
          <div className="flex items-center space-x-2">
            <ModeToggle />
            {/* Mobile Menu */}
            {user && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader className="text-left">
                    <div className="flex items-center space-x-3 mb-6">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="text-lg">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <SheetTitle className="text-left text-base">
                          {getUserName()}
                        </SheetTitle>
                        <p className="text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="flex flex-col space-y-4 mt-8">
                    <SheetClose asChild>
                      <Link
                        href="/"
                        className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                          isActiveLink('/')
                            ? 'text-[#f50a06]'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <Home className="h-5 w-5" />
                        <span className="font-medium">Home</span>
                      </Link>
                    </SheetClose>

                    <SheetClose asChild>
                      <Link
                        href="/projects"
                        className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                          isActiveLink('/projects')
                            ? 'text-[#f50a06] bg-accent'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <FolderOpen className="h-5 w-5" />
                        <span className="font-medium">Projects</span>
                      </Link>
                    </SheetClose>

                    <SheetClose asChild>
                      <Link
                        href="/projects/create"
                        className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                          isActiveLink('/projects/create')
                            ? 'text-[#f50a06] bg-accent'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <Plus className="h-5 w-5" />
                        <span className="font-medium">Create</span>
                      </Link>
                    </SheetClose>

                    <SheetClose asChild>
                      <Link
                        href="/contact"
                        className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                          isActiveLink('/contact')
                            ? 'text-[#f50a06] bg-accent'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <Mail className="h-5 w-5" />
                        <span className="font-medium">Contact Us</span>
                      </Link>
                    </SheetClose>

                    <div className="border-t pt-4 mt-4 space-y-2">
                      <button
                        onClick={handleSignOut}
                        disabled={isLoggingOut}
                        className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-accent transition-colors w-full text-left"
                      >
                        <LogOut className="h-5 w-5" />
                        <span className="font-medium">
                          {isLoggingOut ? 'Signing out...' : 'Sign out'}
                        </span>
                      </button>
                      <button
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={isDeleting}
                        className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors w-full text-left text-destructive"
                      >
                        <Trash2 className="h-5 w-5" />
                        <span className="font-medium">
                          {isDeleting ? 'Deleting...' : 'Delete account'}
                        </span>
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}

            {/* Desktop User Menu */}
            {isLoading || isLoggingOut ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  className="hover:bg-transparent hover:ring-2 hover:ring-ring hover:ring-offset-2"
                >
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full hidden md:flex"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getUserInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {getUserName()}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>{isDeleting ? 'Deleting...' : 'Delete account'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? This action cannot
              be undone. All your data and projects will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
