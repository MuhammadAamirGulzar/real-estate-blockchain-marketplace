import { Card, CardContent } from "@/components/ui/card";
import { Building2, Coins, TrendingUp, UserCheck } from "lucide-react";
import { useMemo } from "react";

// Constants
const PROCESS_STEPS = [
	{
		id: "verification",
		icon: UserCheck,
		title: "Complete KYC",
		description: "Verify your identity securely to start investing",
		stepNumber: 1,
	},
	{
		id: "creation",
		icon: Building2,
		title: "Choose Property",
		description: "Browse vetted real estate opportunities",
		stepNumber: 2,
	},
	{
		id: "access",
		icon: Coins,
		title: "Buy Tokens",
		description: "Purchase fractional shares starting from $100",
		stepNumber: 3,
	},
	{
		id: "returns",
		icon: TrendingUp,
		title: "Earn Returns",
		description: "Receive rental income and capital appreciation",
		stepNumber: 4,
	},
];

const SECTION_CONTENT = {
	heading: "How It Works",
	headingHighlight: "Tokenization",
	description:
		"Start investing in real estate in four simple steps. Our transparent process ensures secure, compliant, and profitable real estate investments",
};

/**
 * Section Header Component
 * Displays title and description for tokenization process
 */
const SectionHeader = () => (
	<div className="mb-12 text-center sm:mb-16">
		<h2 className="mb-4 text-3xl font-bold sm:text-4xl lg:text-5xl text-foreground">
			{SECTION_CONTENT.heading}{" "}
			<span className="text-transparent bg-gradient-to-r from-primary to-secondary bg-clip-text">
				{SECTION_CONTENT.headingHighlight}
			</span>
		</h2>
		<p className="max-w-2xl mx-auto text-base leading-relaxed sm:text-lg lg:text-lg text-muted-foreground">
			{SECTION_CONTENT.description}
		</p>
	</div>
);

/**
 * Step Icon Container Component
 * Displays icon with gradient background
 */
const StepIconContainer = ({ Icon, stepNumber }) => (
	<div className="relative flex justify-center mb-4">
		{/* Background gradient circle */}
		<div className="absolute inset-0 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary opacity-10" />
		{/* Icon container */}
		<div className="relative flex items-center justify-center w-16 h-16 rounded-full shadow-lg bg-gradient-to-br from-primary to-secondary">
			<Icon className="w-8 h-8 text-primary-foreground" />
		</div>
		{/* Step number badge */}
		<div className="absolute flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full -top-2 -right-2 bg-secondary text-secondary-foreground">
			{stepNumber}
		</div>
	</div>
);

/**
 * Step Content Component
 * Displays step title and description
 */
const StepContent = ({ title, description }) => (
	<div className="text-center">
		<h3 className="mb-3 text-lg font-semibold sm:text-xl text-foreground">
			{title}
		</h3>
		<p className="text-sm leading-relaxed sm:text-base text-muted-foreground">
			{description}
		</p>
	</div>
);

/**
 * Process Step Card Component
 * Individual step card with icon, title, and description
 */
const ProcessStepCard = ({ step, index }) => (
	<Card className="relative overflow-hidden transition-all duration-300 group border-border bg-card hover:shadow-xl hover:border-primary/20">
		{/* Background gradient on hover */}
		<div className="absolute inset-0 transition-opacity duration-300 opacity-0 bg-gradient-to-br from-primary/5 to-secondary/5 group-hover:opacity-100" />

		{/* Content */}
		<CardContent className="relative p-6 space-y-4 sm:p-8">
			<StepIconContainer Icon={step.icon} stepNumber={step.stepNumber} />
			<StepContent title={step.title} description={step.description} />
		</CardContent>

		{/* Connection line for desktop (hidden on mobile) */}
		{index < PROCESS_STEPS.length - 1 && (
			<div className="hidden lg:block absolute right-0 top-1/2 w-8 h-0.5 bg-gradient-to-r from-primary/20 to-transparent transform translate-x-full" />
		)}
	</Card>
);

/**
 * Process Steps Grid Component
 * Renders grid of process steps
 */
const ProcessStepsGrid = ({ steps }) => (
	<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 sm:gap-8">
		{steps.map((step, index) => (
			<ProcessStepCard key={step.id} step={step} index={index} />
		))}
	</div>
);

/**
 * TokenizationProcess Component
 * Landing page section explaining the tokenization process.
 * Shows 4 main steps: verification, creation, access, and returns.
 * Includes visual enhancements and responsive design.
 */
export function TokenizationProcess() {
	// Memoize process steps to prevent recalculation
	const steps = useMemo(() => PROCESS_STEPS, []);

	return (
		<section className="relative py-16 sm:py-20 lg:py-24 bg-muted/30 dark:bg-card border-y border-border theme-transition">
			<div className="container-max">
				{/* Section Header */}
				<SectionHeader />

				{/* Process Steps Grid */}
				<ProcessStepsGrid steps={steps} />
			</div>
		</section>
	);
}

export default TokenizationProcess;
