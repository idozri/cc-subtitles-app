'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { XCircle, ArrowLeft } from 'lucide-react';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'InvalidCredentials':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'EmailNotVerified':
        return 'Please verify your email address before signing in.';
      case 'AccountLocked':
        return 'Your account has been temporarily locked. Please try again later.';
      case 'TooManyRequests':
        return 'Too many login attempts. Please wait a moment before trying again.';
      default:
        return 'An authentication error occurred. Please try again.';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <XCircle className="h-6 w-6 text-destructive" />
            Authentication Error
          </CardTitle>
          <CardDescription className="text-center">
            We encountered an issue with your authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{getErrorMessage(error)}</AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Link href="/auth/login">
              <Button className="w-full">Try Again</Button>
            </Link>

            <Link href="/auth/forgot-password">
              <Button variant="outline" className="w-full">
                Forgot Password?
              </Button>
            </Link>
          </div>

          <div className="mt-6 text-center text-sm">
            <Link
              href="/"
              className="text-primary hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
