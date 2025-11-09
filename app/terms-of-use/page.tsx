export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-lg shadow-sm p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">SUBS CAM – TERMS OF USAGE</h1>
          </div>

          <div className="prose prose-sm max-w-none space-y-6">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">1. WHAT IS USAGE:</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Video Transcription Service.</li>
                <li>Video Translation Service</li>
              </ul>

              <div className="space-y-3 mt-4">
                <div>
                  <h3 className="text-xl font-semibold">1.1 DEMO USE:</h3>
                  <p>
                    Maximum transcription duration can change any time.
                  </p>
                  <p className="text-muted-foreground italic">
                    *more / less transcription time
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold">1.2 PERSONAL USE:</h3>
                  <p>
                    Monthly transcription duration plan can change any time.
                  </p>
                  <p className="text-muted-foreground italic">
                    *more / less transcription time
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">2. TRANSLATIONS</h2>
              <p>
                *We are trying to translate your videos texts in the highest
                quality results possible according to Google Translate API.
              </p>
              <p>Service can be paused by system due to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>bugs.</li>
                <li>pause of service by system.</li>
              </ul>

              <div className="space-y-3 mt-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    2.1 FREE TRANSLATIONS GIFTS:
                  </h3>
                  <div className="space-y-2">
                    <p>
                      <strong>Q:</strong> What is a Translations Gifts?
                    </p>
                    <p>
                      <strong>A:</strong> Ability to translate your videos with
                      no charge.
                    </p>
                    <p>
                      <strong>How do i get it?</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>
                        In order to get &quot;Free Translations&quot; as a gift,
                        you&apos;ll need to subscribe for SubsCam&apos;s
                        service.
                      </li>
                      <li>
                        You can use translations gifts only if your
                        subscription&apos;s account is active.
                      </li>
                      <li>
                        Changing &quot;Usage&quot; plan (personal &lt;-&gt;
                        business) translations gift amount will take efect on
                        the next monthly course.
                      </li>
                      <li>
                        &quot;Free translations&quot; gifts amount can be change
                        anytime by SubsCam app system.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

