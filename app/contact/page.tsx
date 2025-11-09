import ContactUsForm from '@/components/ContactUsForm';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-lg shadow-sm p-8 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl md:text-5xl font-bold">
              Get in Touch With Us
            </h1>
            <p className="text-muted-foreground">
              Have questions, ideas, or need support? Fill out the form and our
              team will respond shortly.
            </p>
          </div>
          <ContactUsForm />
        </div>
      </div>
    </div>
  );
}
