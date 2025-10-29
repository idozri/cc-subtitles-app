'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function MobileRedirectContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const type = searchParams.get('type') || 'verify-email'; // Default to verify-email for backward compatibility
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!token) {
      setShowFallback(true);
      return;
    }

    // Generate deep link URL based on type
    let deepLinkUrl: string;
    if (type === 'reset-password') {
      deepLinkUrl = `ccs-subtitles://reset-password?token=${token}`;
    } else {
      // Default to verify-email
      deepLinkUrl = `ccs-subtitles://verify-email?token=${token}${
        email ? `&email=${encodeURIComponent(email)}` : ''
      }`;
    }

    // Try to redirect to mobile app
    setTimeout(() => {
      window.location.href = deepLinkUrl;
    }, 1000);

    // Show fallback after 3 seconds
    setTimeout(() => {
      setShowFallback(true);
    }, 3000);
  }, [token, email, type]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Invalid Link
          </h1>
          <p className="text-gray-600">
            This link is missing required parameters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Redirecting to Mobile App...
        </h1>

        {/* Loading Spinner */}
        <div className="flex justify-center mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>

        <p className="text-gray-600 mb-6">
          Please wait while we redirect you to the mobile app
          {type === 'reset-password' ? ' to reset your password' : ''}.
        </p>

        {/* Fallback Section */}
        {showFallback && (
          <div className="mt-8 p-6 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              If the app doesn't open automatically:
            </h2>

            <a
              href={
                type === 'reset-password'
                  ? `ccs-subtitles://reset-password?token=${token}`
                  : `ccs-subtitles://verify-email?token=${token}${
                      email ? `&email=${encodeURIComponent(email)}` : ''
                    }`
              }
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-4"
            >
              Open Mobile App
            </a>

            <div className="text-sm text-gray-600">
              <p className="mb-2">Or copy this link:</p>
              <div className="bg-gray-100 p-3 rounded border text-xs font-mono break-all">
                {type === 'reset-password'
                  ? `ccs-subtitles://reset-password?token=${token}`
                  : `ccs-subtitles://verify-email?token=${token}${
                      email ? `&email=${encodeURIComponent(email)}` : ''
                    }`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MobileRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <MobileRedirectContent />
    </Suspense>
  );
}
