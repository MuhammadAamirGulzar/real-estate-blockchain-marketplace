# 🎨 RWAchain Design System - Quick Reference

## Color Palette

### Primary Colors

```css
--primary: 217 91% 60%         /* Professional Blue */
--primary-hover: 217 91% 55%   /* Darker on hover */
--primary-light: 217 91% 95%   /* Light background */
```

### Secondary Colors

```css
--secondary: 142 71% 45%       /* Wealth Green */
--secondary-hover: 142 71% 40% /* Darker on hover */
--secondary-light: 142 71% 95% /* Light background */
```

### Accent Colors

```css
--accent: 43 96% 56%          /* Premium Gold */
--accent-hover: 43 96% 51%    /* Darker on hover */
--accent-light: 43 96% 95%    /* Light background */
```

### Status Colors

```css
--success: 142 71% 45%        /* Green */
--warning: 38 92% 50%         /* Amber */
--destructive: 0 72% 51%      /* Red */
--info: 199 89% 48%          /* Cyan */
```

---

## Gradient Classes

### Text Gradients

```jsx
// Primary → Secondary
<h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
  Gradient Text
</h1>

// Primary → Secondary → Accent
<h1 className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
  Multi-stop Gradient
</h1>
```

### Background Gradients

```jsx
// Subtle mesh background
<div className="gradient-mesh" />

// Animated shine
<div className="gradient-shine" />

// Simple gradient
<div className="bg-gradient-to-br from-primary to-secondary" />
```

---

## Shadow System

### Usage

```jsx
// Premium shadow for cards
<Card className="shadow-premium" />

// Floating shadow (hover effect)
<Card className="shadow-float" />

// Glowing shadow
<Button className="shadow-glow" />

// Glow on hover
<Card className="shadow-glow-hover" />
```

---

## Animation Classes

### Entrance Animations

```jsx
// Fade in with slide up
<div className="animate-fade-in" />

// Slide up
<div className="animate-slide-up" />

// Scale in
<div className="animate-scale-in" />
```

### Continuous Animations

```jsx
// Gentle floating
<div className="animate-float" />

// Soft pulse
<div className="animate-pulse-soft" />

// Shimmer effect
<div className="animate-shimmer" />
```

### Hover Effects

```jsx
// Lift card on hover
<Card className="card-hover-lift" />

// 3D button effect
<Button className="button-3d" />
```

---

## Button Variants

### Primary Buttons

```jsx
<Button>Default Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="accent">Accent</Button>
<Button variant="destructive">Destructive</Button>
```

### Outline Buttons

```jsx
<Button variant="outline">Default Outline</Button>
<Button variant="outline-primary">Primary Outline</Button>
```

### Ghost Button

```jsx
<Button variant="ghost">Ghost Button</Button>
```

### Sizes

```jsx
<Button size="sm">Small</Button>
<Button>Default</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
```

### With Gradient

```jsx
<Button className="bg-gradient-to-r from-primary to-primary-hover">
  Gradient Button
</Button>
```

---

## Card Variants

### Base Card

```jsx
<Card className="card-base">
  <CardContent>Basic card</CardContent>
</Card>
```

### Elevated Card

```jsx
<Card className="card-elevated">
  <CardContent>Elevated with shadow</CardContent>
</Card>
```

### Interactive Card

```jsx
<Card className="card-interactive">
  <CardContent>Hover effects</CardContent>
</Card>
```

### Glassmorphic Card

```jsx
<Card className="card-glass-morphism">
  <CardContent>Frosted glass effect</CardContent>
</Card>
```

### Hover Lift Card

```jsx
<Card className="card-hover-lift">
  <CardContent>Lifts on hover</CardContent>
</Card>
```

---

## Status Indicators

### Pulsing Dot

```jsx
<div className="flex items-center gap-2">
  <div className="indicator-dot bg-success" />
  <span>Active</span>
</div>
```

### Status Badge

```jsx
// Success
<Badge className="bg-success/10 text-success border-success/20">Active</Badge>

// Warning
<Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>

// Error
<Badge className="bg-destructive/10 text-destructive border-destructive/20">Error</Badge>
```

---

## Loading States

### Skeleton Loader

```jsx
<div className="skeleton h-20 w-full rounded-xl" />
```

### Shimmer Effect

```jsx
<div className="animate-shimmer h-40 rounded-xl" />
```

### Pulse Animation

```jsx
<div className="animate-pulse-soft opacity-50" />
```

---

## Glassmorphism

### Glass Container

```jsx
<div className="bg-card/80 backdrop-blur-xl border border-border/40 rounded-2xl">
  <div className="p-6">Content</div>
</div>
```

### Glass Card

```jsx
<Card className="card-glass-morphism">
  <CardContent>Frosted glass effect</CardContent>
</Card>
```

---

## Patterns

### Grid Pattern Background

```jsx
<div className="bg-grid opacity-[0.02]" />
```

### Dots Pattern Background

```jsx
<div className="bg-dots opacity-[0.03]" />
```

---

## Responsive Containers

### Container Sizes

```jsx
// Standard container (max-width: 80rem)
<div className="container-max">Content</div>

// Narrow container (max-width: 56rem)
<div className="container-narrow">Content</div>

// Wide container (max-width: 96rem)
<div className="container-wide">Content</div>
```

---

## Border Styles

### Gradient Border

```jsx
<div className="border-gradient p-6">Content with gradient border</div>
```

### Subtle Border

```jsx
<div className="border border-border/40 rounded-xl">Subtle border</div>
```

---

## Focus States

### Custom Focus Ring

```jsx
<button className="focus-ring">Button with custom focus</button>
```

### Focus Visible

```jsx
<button className="focus:ring-2 focus:ring-primary focus:ring-offset-2">
  Standard focus
</button>
```

---

## Scrollbar Styling

```jsx
<div className="scrollbar-thin overflow-auto">
  Content with custom scrollbar
</div>
```

---

## Common Patterns

### Hero Section

```jsx
<section className="relative py-24 md:py-32 overflow-hidden">
  {/* Background */}
  <div className="absolute inset-0 gradient-mesh opacity-60" />
  <div className="absolute inset-0 bg-grid opacity-[0.02]" />

  {/* Floating Orbs */}
  <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />

  {/* Content */}
  <div className="container-max relative z-10">{/* Your content */}</div>
</section>
```

### Feature Card

```jsx
<Card className="card-hover-lift border-border/50">
  <CardHeader>
    <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-primary" />
    </div>
    <CardTitle>Feature Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground">Feature description</p>
  </CardContent>
</Card>
```

### Stat Display

```jsx
<div className="text-center">
  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
    <Icon className="w-7 h-7 text-primary" />
  </div>
  <div className="text-4xl font-bold bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent mb-2">
    150+
  </div>
  <div className="text-muted-foreground font-medium text-sm">Properties</div>
</div>
```

### CTA Section

```jsx
<Card className="relative overflow-hidden border-0 shadow-float">
  {/* Gradient Background */}
  <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-secondary" />

  {/* Floating Shapes */}
  <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />

  <CardContent className="relative py-16 px-8 text-center text-primary-foreground">
    <h2 className="text-4xl font-bold mb-4">Call to Action</h2>
    <p className="text-xl opacity-90 mb-6">Description text</p>
    <Button className="bg-white text-primary hover:bg-white/90">
      Get Started
    </Button>
  </CardContent>
</Card>
```

### Profile Dropdown Item

```jsx
<Link
  to="/dashboard"
  className={`
    flex items-center space-x-3 px-6 py-3 text-sm transition-all duration-200 mx-2 rounded-xl
    ${
      isActive
        ? "bg-primary/10 text-primary font-semibold border border-primary/20"
        : "text-foreground hover:bg-muted/50"
    }
  `}
>
  <Icon className="w-4 h-4" />
  <span>Dashboard</span>
  {isActive && (
    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
  )}
</Link>
```

---

## Tips & Best Practices

### Performance

- Use `transform` and `opacity` for animations (GPU accelerated)
- Apply `backdrop-filter` sparingly (can be expensive)
- Use `will-change` only when necessary
- Prefer CSS animations over JS for simple effects

### Accessibility

- Always include focus states (`:focus-visible`)
- Ensure color contrast meets WCAG AA standards
- Respect `prefers-reduced-motion`
- Use semantic HTML elements
- Add ARIA labels when needed

### Responsive Design

- Mobile-first approach with Tailwind breakpoints
- Test at common breakpoints: 320px, 768px, 1024px, 1440px
- Use container classes for consistent width
- Ensure touch targets are at least 44×44px

### Dark Mode

- All colors use HSL variables for automatic dark mode
- Test both light and dark themes
- Ensure sufficient contrast in both modes
- Use opacity for subtle elements

### Animation Timing

- **Micro-interactions**: 150-200ms
- **UI Feedback**: 200-300ms
- **Entrance/Exit**: 300-500ms
- **Decorative**: 1000ms+

---

## Color Usage Guidelines

### Primary (Blue)

Use for: Main CTAs, links, primary actions, active states
Avoid: Large backgrounds, too much use dilutes importance

### Secondary (Green)

Use for: Success states, positive metrics, growth indicators
Avoid: Warnings or neutral information

### Accent (Gold)

Use for: Premium features, highlights, special badges
Avoid: Overuse - keep for truly special elements

### Destructive (Red)

Use for: Delete actions, errors, critical warnings
Avoid: General information or neutral actions

---

## Spacing Scale

```
sm:  0.5rem  (8px)
md:  0.75rem (12px)
base: 1rem   (16px)
lg:  1.5rem  (24px)
xl:  2rem    (32px)
2xl: 3rem    (48px)
```

---

## Border Radius Scale

```
--radius-sm:  0.5rem  (8px)
--radius-md:  0.625rem (10px)
--radius:     0.75rem (12px)
--radius-lg:  1rem    (16px)
--radius-xl:  1.5rem  (24px)
```

---

**Last Updated**: Phase 1 Complete  
**Version**: 2.0  
**Status**: Production Ready ✅
