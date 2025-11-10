import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from './providers';
import { Navigation } from '@/components/navigation';
import { Toaster } from '@/components/ui';
import { BlockedUserProvider } from '@/components/blocked-user-provider';
import { ThemeProvider } from '@/components/theme-provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  'https://app.cc-subtitles.com';
const siteName = 'CC Subtitles';
const siteDescription =
  'Transform your videos into professional subtitles with AI-powered transcription and translation.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CC Subtitles – AI-Powered Video Transcription & Subtitles',
    template: '%s | CC Subtitles',
  },
  description: siteDescription,
  keywords: [
    'video transcription',
    'AI subtitles',
    'automatic subtitles',
    'video captions',
    'speech to text',
    'video translation',
    'multilingual subtitles',
    'subtitle editor',
    'closed captions',
    'video accessibility',
    'transcription service',
    'AI transcription',
    'video subtitles generator',
    'automatic captions',
    'video to text',
    'subtitle maker',
    'caption generator',
    'video transcription software',
  ],
  authors: [{ name: 'CC Subtitles', url: siteUrl }],
  creator: 'CC Subtitles',
  publisher: 'CC Subtitles',
  applicationName: siteName,
  category: 'Video Transcription & Subtitles',
  classification: 'Software',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: siteName,
    title: 'CC Subtitles – AI-Powered Video Transcription & Subtitles',
    description: siteDescription,
    images: [
      {
        url: `${siteUrl}/opengraph-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'CC Subtitles – AI-Powered Video Transcription & Subtitles',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CC Subtitles – AI-Powered Video Transcription & Subtitles',
    description: siteDescription,
    images: [`${siteUrl}/opengraph-image.jpg`],
    creator: '@cc-subtitles',
    site: '@cc-subtitles',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
      noimageindex: false,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  verification: {
    // Add verification codes here when available
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteName,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: siteDescription,
    url: siteUrl,
    publisher: {
      '@type': 'Organization',
      name: 'CC Subtitles',
      url: siteUrl,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
    },
    featureList: [
      'AI-powered video transcription',
      'Automatic subtitle generation',
      'Multilingual translation support',
      'Subtitle editor',
      'Multiple export formats',
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <BlockedUserProvider>
              <Navigation />
              {children}
              <Toaster />
            </BlockedUserProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
