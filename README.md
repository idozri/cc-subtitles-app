# CC Subtitles AI - Client

A Next.js client application with complete authentication flow using Auth.js and a NestJS backend.

## Features

- 🔐 **Complete Authentication Flow** - Register, login, email verification, password reset
- 🛡️ **Route Protection** - Middleware-based route protection with automatic redirects
- 🎨 **Modern UI** - Built with shadcn/ui components and Tailwind CSS
- 📱 **Responsive Design** - Works on all devices
- 🔄 **Session Management** - Automatic token refresh and session handling

## Authentication Flow

### 1. Registration

- User fills out registration form
- Account is created but email is not verified
- Verification email is sent
- User must verify email before logging in

### 2. Email Verification

- User clicks link in email or enters token manually
- Email is verified and user can now log in

### 3. Login

- User enters credentials
- Auth.js handles authentication with NestJS backend
- Session is created and user is redirected to protected area

### 4. Password Reset

- User requests password reset
- Reset email is sent with token
- User enters new password with token

### 5. Route Protection

- Unauthenticated users are redirected to home page
- Authenticated users trying to access auth pages are redirected to dashboard
- Protected routes are under `/(protected)` folder

## Project Structure

```
app/
├── (auth)/                    # Authentication pages
│   ├── login/page.tsx         # Login form
│   ├── register/page.tsx      # Registration form
│   ├── verify-email/page.tsx  # Email verification
│   ├── forgot-password/page.tsx # Password reset request
│   ├── reset-password/page.tsx # Password reset form
│   └── error/page.tsx         # Auth error page
├── (protected)/               # Protected routes
│   ├── layout.tsx             # Protected layout with navigation
│   └── page.tsx               # Dashboard
├── api/
│   └── auth/[...nextauth]/    # Auth.js API routes
│       └── route.ts
├── api/common/
│   └── client.tsx             # API client configuration
├── components/
│   └── navigation.tsx         # Navigation component
├── lib/
│   └── auth.ts                # Auth.js configuration
├── types/
│   └── next-auth.d.ts         # Auth.js type definitions
├── layout.tsx                 # Root layout
├── page.tsx                   # Welcome page
└── providers.tsx              # App providers
```

## Environment Variables

Create a `.env.local` file in the client directory:

```env
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-nextauth-secret-key-change-in-production
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables (see above)

3. Start the development server:

```bash
npm run dev
```

4. Make sure the NestJS server is running on port 3000

## Authentication Pages

### `/auth/register`

Registration form with email verification

### `/auth/login`

Login form with credential authentication

### `/auth/verify-email`

Email verification page (handles tokens from URL)

### `/auth/forgot-password`

Password reset request form

### `/auth/reset-password`

Password reset form (handles tokens from URL)

### `/auth/error`

Authentication error page

## Protected Routes

All routes under `/(protected)` require authentication:

- `/(protected)/` - Dashboard
- `/(protected)/profile` - User profile (to be implemented)
- `/(protected)/settings` - User settings (to be implemented)

## API Integration

The client communicates with the NestJS server using:

- **Base URL**: `http://localhost:5000` (configurable via `NEXT_PUBLIC_API_URL`)
- **Authentication**: HTTP-only cookies for JWT tokens
- **Automatic Refresh**: Token refresh handled automatically by axios interceptors

## Middleware

The middleware (`middleware.ts`) handles:

- Route protection for `/(protected)` routes
- Redirects for authenticated users trying to access auth pages
- Redirects for unauthenticated users trying to access protected pages

## Components

### Navigation

- User avatar with dropdown menu
- Logout functionality
- Links to profile and settings

### Forms

- Registration form with validation
- Login form with error handling
- Password reset forms
- Email verification form

## Styling

- **UI Framework**: shadcn/ui components
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Responsive**: Mobile-first design

## Development

### Adding New Protected Routes

1. Create the route under `app/(protected)/`
2. The middleware will automatically protect it
3. Add navigation links in the Navigation component

### Adding New Auth Pages

1. Create the page under `app/(auth)/`
2. Update the middleware if needed
3. Add links in the welcome page or other auth pages

### Customizing Authentication

1. Modify `lib/auth.ts` for Auth.js configuration
2. Update `types/next-auth.d.ts` for type definitions
3. Modify API client in `app/api/common/client.tsx`

## Production Deployment

1. Set production environment variables
2. Build the application: `npm run build`
3. Start the production server: `npm start`
4. Ensure the NestJS server is deployed and accessible

## Security Features

- HTTP-only cookies for JWT storage
- Automatic token refresh
- CSRF protection (handled by NestJS)
- Rate limiting (handled by NestJS)
- Secure password requirements
- Email verification required
- Session management with automatic logout

## Video streaming from S3 (progressive MP4)

To play large MP4 files from S3 without HLS, rely on HTTP Range Requests (the browser will request only needed byte ranges):

- Ensure MP4 is optimized for fast start:
  - `ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4`
- Set object metadata:
  - `Content-Type: video/mp4`
  - Avoid `Content-Encoding: gzip` on videos
- S3 bucket CORS (tighten origins as needed):

```json
[
  {
    "AllowedHeaders": ["*", "Range"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [
      "Accept-Ranges",
      "Content-Range",
      "Content-Length",
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

In the client, the `<video>` element includes `preload="metadata"`, `playsInline`, and `crossOrigin="anonymous"` (if drawing frames to canvas). Pre-signed URLs are compatible with range requests.
