import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get tokens from cookies
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // Check if user is authenticated
  let isAuthenticated = !!accessToken;

  // If no access token but refresh token exists, try to refresh
  if (!accessToken && refreshToken) {
    try {
      // Attempt to refresh the access token
      const refreshResponse = await fetch(
        `${request.nextUrl.origin}/api/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: request.headers.get('cookie') || '',
          },
        }
      );

      if (refreshResponse.ok) {
        // If refresh was successful, update authentication status
        isAuthenticated = true;

        // Create a new response to forward the new cookies
        const response = NextResponse.next();

        // Forward the new cookies from the refresh response
        const setCookieHeaders = refreshResponse.headers.getSetCookie();
        setCookieHeaders.forEach((cookie) => {
          response.headers.append('Set-Cookie', cookie);
        });

        return response;
      }
    } catch (error) {
      console.error('Token refresh failed in middleware:', error);
      // If refresh fails, continue with unauthenticated flow
    }
  }

  // Define auth pages that should be accessible without authentication
  const authPages = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ];
  const isAuthPage = authPages.some((page) => pathname.startsWith(page));

  // Define protected pages that require authentication
  // NOTE: Avoid using `includes('/')` which matches every path (including assets),
  // and instead check exact root match or prefix matches for app routes.
  const protectedPages = ['/', '/projects'];
  const isProtectedPage = isAuthPage
    ? false
    : protectedPages.some((page) => {
        if (page === '/') return pathname === '/';
        return pathname.startsWith(page);
      });

  // If user is authenticated and trying to access auth pages, redirect to home
  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is not authenticated and trying to access protected pages, redirect to login
  // attach redirect url to the query params
  if (!isAuthenticated && isProtectedPage) {
    return NextResponse.redirect(
      new URL(
        `/login${pathname !== '/' ? `?redirect=${pathname.substring(1)}` : ''}`,
        request.url
      )
    );
  }

  return NextResponse.next();
}

export const config = {
  // Exclude Next internals and static assets served from `public/assets/**`
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets/).*)'],
};
