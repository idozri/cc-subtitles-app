import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for CC Subtitles AI. Learn how we collect, use, and protect your data when using our AI-powered video transcription and subtitle generation service.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Privacy Policy | CC Subtitles AI',
    description:
      'Privacy Policy for CC Subtitles AI. Learn how we collect, use, and protect your data when using our AI-powered video transcription and subtitle generation service.',
    type: 'website',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-lg shadow-sm p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <div className="space-y-1 text-muted-foreground">
              <p className="font-semibold">Subtitles Ai</p>
              <p>Developer: LegoTechApps</p>
              <p>Version: 1.0 – Last updated: June 23, 2025</p>
            </div>
          </div>

          <div className="prose prose-sm max-w-none space-y-6">
            <p>
              This Privacy Policy describes how LegoTechApps collects, uses, and
              protects your data when using the Subtitles Ai app. By using the
              app, you agree to the terms described below.
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">1. Information We Collect</h2>

              <div className="space-y-3">
                <div>
                  <h3 className="text-xl font-semibold">1.1 Device Identifier</h3>
                  <p>
                    We generate and store a unique identifier for your device
                    (such as a system-generated token or ID). This helps
                    associate usage data with your device and is stored
                    internally in our secure database.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold">1.2 Usage Data</h3>
                  <p>
                    We collect data related to your app activity, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Transcription results and processing metadata</li>
                    <li>Translation requests and responses</li>
                    <li>Subtitle edits and interaction history</li>
                    <li>
                      General app usage behavior (feature usage frequency, etc.)
                    </li>
                  </ul>
                  <p>
                    This data is used only to support and improve app
                    functionality.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold">1.3 Log Data</h3>
                  <p>We may collect basic technical data such as:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>IP address</li>
                    <li>Device type and operating system version</li>
                    <li>Timestamps and app configuration</li>
                    <li>Error or crash diagnostics</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">
                2. Audio Upload and Processing
              </h2>
              <p>
                When you request transcription, the app uploads your audio file
                to our secure server for temporary processing. Key points:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Audio is used only for your transcription request</li>
                <li>
                  Files are automatically deleted after processing is complete
                </li>
                <li>
                  We never store audio long-term, share it, or use it for
                  profiling or training
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">3. Translation Services</h2>
              <p>When you request translation:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  Only transcription text is sent to external translation
                  services
                </li>
                <li>No audio or personal identifiers are shared</li>
                <li>We use third parties solely to return translated text</li>
                <li>
                  We do not use any analytics, advertising, or tracking SDKs
                </li>
              </ul>
              <p>
                Specifically, we use the Google Translate API for performing
                translations. Google&apos;s handling of translated content is
                governed by their own privacy policy:{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://policies.google.com/privacy
                </a>
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">
                4. How We Use Your Information
              </h2>
              <p>We use collected data for the following purposes:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>To process transcription and translation requests</li>
                <li>
                  To save your project and history locally or on your device
                </li>
                <li>To improve app performance and reliability</li>
                <li>To resolve technical issues and bugs</li>
                <li>To ensure a smooth and responsive user experience</li>
              </ul>
              <p>
                We do not use your data for marketing, profiling, or resale.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">5. Data Retention</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  Audio files are deleted immediately after transcription is
                  completed
                </li>
                <li>
                  Usage data is stored only as needed to support app
                  functionality and maintain a history of your actions inside
                  the app
                </li>
                <li>We do not retain unnecessary or excessive data</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">6. Data Security</h2>
              <p>
                We take reasonable technical and organizational precautions to
                protect your data against unauthorized access, alteration, or
                disclosure. However, no method of transmission or storage is
                completely secure. Use of the app implies acceptance of this
                risk.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">
                7. Changes to This Privacy Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. All updates
                will be posted on this page and take effect immediately. Please
                review this page periodically to stay informed of changes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">8. Contact</h2>
              <p>If you have questions, please contact:</p>
              <ul className="list-none space-y-1 ml-4">
                <li>
                  Email:{' '}
                  <a
                    href="mailto:contact@legotechapps.com"
                    className="text-primary hover:underline"
                  >
                    contact@legotechapps.com
                  </a>
                </li>
                <li>
                  Website:{' '}
                  <a
                    href="https://www.legotechapps.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    https://www.legotechapps.com
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}


