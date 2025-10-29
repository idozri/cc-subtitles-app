'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Loader2,
  Mail,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';

const resendVerificationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ResendVerificationFormData = z.infer<typeof resendVerificationSchema>;

export default function ResendVerificationEmailPage() {
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const form = useForm<ResendVerificationFormData>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: {
      email: '',
    },
  });

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

  // Cleanup effect to reset loading state if component unmounts
  useEffect(() => {
    return () => {
      setIsResending(false);
    };
  }, []);

  const handleResendVerification = async (data: ResendVerificationFormData) => {
    if (resendTimer > 0 || isResending) return;

    setIsResending(true);
    setSuccess('');
    setError('');

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
      });

      await Promise.race([
        client.post('/auth/resend-email-verification', {
          email: data.email,
          platform: 'web', // Specify web platform for client
        }),
        timeoutPromise,
      ]);

      setSuccess('Verification email sent successfully!');
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
            Resend Verification
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email address to resend the verification email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleResendVerification)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="Enter your email address"
                        autoCapitalize="none"
                        autoCorrect="off"
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

              <Button
                type="submit"
                className="w-full"
                disabled={isResending || resendTimer > 0}
              >
                {isResending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {resendTimer > 0 ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend in {formatTime(resendTimer)}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 space-y-2">
            <div className="text-sm text-muted-foreground text-center">
              Check your email for the verification link. If you don't see it,
              check your spam folder.
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-4 text-sm">
            <Link
              href="/verify-email"
              className="text-primary hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Verify
            </Link>
            <Link href="/login" className="text-primary hover:underline">
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
