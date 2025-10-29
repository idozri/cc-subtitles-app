'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { client } from '@/api/common/client';
import { Loader2, Mail, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Please enter a verification token'),
});

type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [email, setEmail] = useState('');

  const form = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      token: '',
    },
  });

  // Check if token is in URL params
  useEffect(() => {
    const urlToken = searchParams.get('token');
    const urlEmail = searchParams.get('email');

    if (urlEmail) {
      setEmail(urlEmail);
    }

    if (urlToken) {
      form.setValue('token', urlToken);
      handleVerifyEmail(urlToken);
    }
  }, [searchParams, form]);

  // Handle resend timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Cleanup effect to reset loading states if component unmounts
  useEffect(() => {
    return () => {
      setIsResending(false);
      setIsLoading(false);
    };
  }, []);

  const handleVerifyEmail = async (verificationToken: string) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await client.post('/auth/verify-email', {
        token: verificationToken,
      });

      if (response.data.success) {
        setSuccess(
          'Email verified successfully! You can now sign in to your account.'
        );
        setIsVerified(true);
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (error: any) {
      setError(
        error.response?.data?.message ||
          'Email verification failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || resendTimer > 0 || isResending) return;

    setIsResending(true);
    setResendSuccess('');
    setError('');

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
      });

      await Promise.race([
        client.post('/auth/resend-email-verification', {
          email: email,
          platform: 'web', // Specify web platform for client
        }),
        timeoutPromise,
      ]);

      setResendSuccess('Verification email sent successfully!');
      setResendTimer(60); // 60 second cooldown
    } catch (err: any) {
      console.error('Resend verification error:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to resend verification email. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  const onSubmit = async (data: VerifyEmailFormData) => {
    await handleVerifyEmail(data.token);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Mail className="h-6 w-6" />
            Verify Email
          </CardTitle>
          <CardDescription className="text-center">
            {isVerified
              ? 'Your email has been verified successfully!'
              : 'Enter the verification token sent to your email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isVerified ? (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your email has been verified successfully! You can now sign in
                  to your account.
                </AlertDescription>
              </Alert>
              <Button onClick={() => router.push('/login')} className="w-full">
                Go to Sign In
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Token</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter verification token"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {error && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>{success}</AlertDescription>
                    </Alert>
                  )}

                  {resendSuccess && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>{resendSuccess}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Verify Email
                  </Button>
                </form>
              </Form>

              <div className="space-y-2">
                <div className="text-sm text-muted-foreground text-center ">
                  Didn't receive the email?
                  <Link
                    href="/resend-verification-email"
                    className="text-primary hover:underline ml-2"
                  >
                    Resend Email
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-sm space-x-4">
            <Link href="/login" className="text-primary hover:underline">
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}
