export default function TermsOfServicePage() {
  return (
    <div className="py-12 bg-background dark:bg-background">
      <div className="container-max">
        <div className="max-w-4xl mx-auto">
          <h1 className="mb-4 text-4xl font-bold text-foreground dark:text-foreground">
            Terms of Service
          </h1>
          <p className="mb-8 text-muted-foreground dark:text-muted-foreground">
            Last updated: November 2024
          </p>

          <div className="space-y-8 text-foreground">
            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground dark:text-foreground">
                1. Acceptance of Terms
              </h2>
              <p className="leading-relaxed text-muted-foreground dark:text-muted-foreground">
                By accessing and using the RWA Platform, you accept and agree to
                be bound by the terms and conditions of this agreement.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground dark:text-foreground">
                2. Eligibility
              </h2>
              <p className="leading-relaxed text-muted-foreground dark:text-muted-foreground">
                You must be at least 18 years old and comply with all applicable
                laws to use our platform. KYC verification is required for all
                investors.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground dark:text-foreground">
                3. Investment Risks
              </h2>
              <p className="leading-relaxed text-muted-foreground dark:text-muted-foreground">
                Real estate investments carry inherent risks. Past performance
                does not guarantee future results. You should carefully consider
                your financial situation before investing.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground dark:text-foreground">
                4. User Responsibilities
              </h2>
              <p className="leading-relaxed text-muted-foreground dark:text-muted-foreground">
                You are responsible for maintaining the security of your account
                and for all activities that occur under your account.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground dark:text-foreground">
                5. Prohibited Activities
              </h2>
              <p className="leading-relaxed text-muted-foreground dark:text-muted-foreground">
                You may not use the platform for any illegal purposes, including
                money laundering, fraud, or market manipulation.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
