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
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

export function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearUser, isLoading } = useUserStore();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Helper function to check if a link is active
  const isActiveLink = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href === '/projects/new') {
      return pathname === '/projects/new';
    }
    if (href === '/projects') {
      return pathname === '/projects';
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
                alt="CC Subtitles AI Logo"
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="text-xl font-bold">Subtitles AI</span>
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
                href="/projects/new"
                className={`font-medium transition-colors ${
                  isActiveLink('/projects/new')
                    ? 'text-[#f50a06]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Create
              </Link>
            </nav>
          )}

          {/* Right side - User menu and mobile menu */}
          <div className="flex items-center space-x-2">
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
                        href="/projects/new"
                        className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                          isActiveLink('/projects/new')
                            ? 'text-[#f50a06] bg-accent'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <Plus className="h-5 w-5" />
                        <span className="font-medium">Create</span>
                      </Link>
                    </SheetClose>

                    <div className="border-t pt-4 mt-4">
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
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
