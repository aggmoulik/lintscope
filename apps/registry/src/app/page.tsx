import { DiagnosticCard, Icon, type IconName, LintDashboard, LinterLogo } from '@lintscope/ui';
import type { ReactNode } from 'react';
import { CommandChip } from './_components/command-chip';
import { sampleDiagnostic, sampleReport } from './_data/sample-report';

const GITHUB_URL = 'https://github.com/aggmoulik/lintscope';
const STUDIO_CMD = 'npx lintscope studio';

/* ------------------------------------------------------------------ content */

const ACTIVE_LINTERS = ['eslint', 'biome', 'oxc'] as const;
const SOON_LINTERS = ['tsc', 'stylelint'] as const;

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'command',
    title: 'Run it in your repo',
    body: 'lintscope finds every linter configured in your workspace — ESLint, Biome, OXC — runs them, and merges the output into one normalized report.',
  },
  {
    icon: 'search',
    title: 'Open the dashboard',
    body: 'Your browser opens to a local dashboard wired straight to the CLI over localhost. Your code and diagnostics never leave the machine.',
  },
  {
    icon: 'wand',
    title: 'Triage, fast',
    body: 'Filter by rule, severity, or file. Jump to source with inline previews. See exactly what is auto-fixable at a glance.',
  },
];

const COMPONENTS: { name: string; title: string; description: string; needs?: string }[] = [
  {
    name: 'severity-badge',
    title: 'SeverityBadge',
    description: 'A compact pill for error / warning / info severity.',
  },
  {
    name: 'diagnostic-card',
    title: 'DiagnosticCard',
    description: 'One diagnostic — rule link, exact location, fixability indicator.',
    needs: 'severity-badge',
  },
  {
    name: 'diagnostic-list',
    title: 'DiagnosticList',
    description: 'A virtualized list — holds 60fps at 100k+ diagnostics.',
    needs: 'diagnostic-card',
  },
  {
    name: 'lint-dashboard',
    title: 'LintDashboard',
    description: 'The whole thing: stat header + virtualized list. Drop in a LintReport.',
    needs: 'diagnostic-list',
  },
];

/* ------------------------------------------------------------------ helpers */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faint">
      <span aria-hidden className="h-2 w-2 rounded-[2px] bg-accent" />
      {children}
    </span>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------- page */

export default function HomePage() {
  return (
    <div className="lintscope-surface relative min-h-screen overflow-x-hidden">
      {/* atmosphere: paper grain + two soft accent blooms */}
      <div
        aria-hidden
        className="grain pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-overlay"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] z-0 h-[520px] w-[520px] rounded-full bg-accent/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-15%] top-[680px] z-0 h-[460px] w-[460px] rounded-full bg-violet/10 blur-[130px]"
      />

      <div className="relative z-10">
        {/* ---------------------------------------------------------- nav */}
        <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/70 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
            <a href="/" className="flex items-center gap-2.5">
              <span aria-hidden className="h-4 w-4 rounded-[4px] bg-accent shadow-card" />
              <span className="font-mono text-[15px] font-semibold tracking-tight text-ink">
                lintscope
              </span>
            </a>
            <nav className="flex items-center gap-0.5">
              <NavLink href="#components">Components</NavLink>
              <NavLink href="#how">How it works</NavLink>
              <a
                href={GITHUB_URL}
                className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                GitHub
                <span aria-hidden className="text-ink-faint">
                  ↗
                </span>
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6">
          {/* -------------------------------------------------------- hero */}
          <section className="flex flex-col items-center gap-7 pt-20 pb-14 text-center sm:pt-28">
            <div className="rise" style={{ animationDelay: '0ms' }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
                Open source · pre-alpha
              </span>
            </div>

            <h1
              className="rise max-w-3xl font-display text-5xl leading-[1.04] tracking-tight text-balance text-ink sm:text-6xl md:text-7xl"
              style={{ animationDelay: '70ms' }}
            >
              Thousands of diagnostics,
              <br className="hidden sm:block" /> one <em className="italic text-accent">quiet</em>{' '}
              dashboard.
            </h1>

            <p
              className="rise max-w-xl text-lg leading-relaxed text-ink-muted text-pretty"
              style={{ animationDelay: '140ms' }}
            >
              lintscope turns ESLint, Biome, and OXC output into a fast, local-first UI you can
              actually browse — plus copy-paste React components to build your own.
            </p>

            <div
              className="rise flex w-full max-w-md flex-col items-center gap-3"
              style={{ animationDelay: '210ms' }}
            >
              <CommandChip command={STUDIO_CMD} className="w-full" />
              <div className="flex items-center gap-5 text-sm">
                <a
                  href="#components"
                  className="font-medium text-accent underline-offset-4 hover:underline"
                >
                  Browse the components →
                </a>
                <a href="#how" className="text-ink-muted underline-offset-4 hover:underline">
                  How it works
                </a>
              </div>
            </div>

            <p
              className="rise font-mono text-xs text-ink-faint"
              style={{ animationDelay: '280ms' }}
            >
              MIT licensed · Local-first · No telemetry — your code never leaves your machine
            </p>
          </section>

          {/* ----------------------------------------------------- showcase */}
          <section className="relative pb-8">
            <div className="mb-4 flex items-center justify-center">
              <Eyebrow>Live · running on sample data</Eyebrow>
            </div>
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-6 -top-8 bottom-8 rounded-[2rem] bg-accent/10 blur-3xl"
              />
              <div className="relative overflow-hidden rounded-xl border border-line-strong bg-surface shadow-card">
                {/* window chrome */}
                <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-error/70" />
                    <span className="h-3 w-3 rounded-full bg-warning/70" />
                    <span className="h-3 w-3 rounded-full bg-ok/70" />
                  </div>
                  <div className="mx-auto inline-flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-1 font-mono text-xs text-ink-faint">
                    <Icon name="branch" size={12} />
                    localhost:7420/studio
                  </div>
                </div>
                <div className="max-h-[600px] overflow-hidden p-4 sm:p-5">
                  <LintDashboard report={sampleReport} />
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------ linters */}
          <section className="flex flex-col items-center gap-6 py-16">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-faint">
              Built for the linters you already run
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {ACTIVE_LINTERS.map((source) => (
                <span
                  key={source}
                  className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-card"
                >
                  <LinterLogo source={source} size={18} />
                  {source === 'oxc' ? 'OXC' : source === 'eslint' ? 'ESLint' : 'Biome'}
                </span>
              ))}
              {SOON_LINTERS.map((source) => (
                <span
                  key={source}
                  className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-line px-4 py-2 text-sm text-ink-faint"
                >
                  <LinterLogo source={source} size={18} className="opacity-50" />
                  {source === 'tsc' ? 'tsc' : 'Stylelint'}
                  <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                    soon
                  </span>
                </span>
              ))}
            </div>
          </section>

          {/* --------------------------------------------------- how it works */}
          <section id="how" className="scroll-mt-20 border-t border-line py-20">
            <div className="flex flex-col gap-3">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="max-w-2xl font-display text-3xl tracking-tight text-ink sm:text-4xl">
                Three steps from terminal soup to a clean view.
              </h2>
            </div>
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <Icon name={step.icon} size={20} />
                    </span>
                    <span className="font-display text-2xl text-ink-faint">0{i + 1}</span>
                  </div>
                  <h3 className="text-base font-semibold text-ink">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* --------------------------------------------------- components */}
          <section id="components" className="scroll-mt-20 border-t border-line py-20">
            <div className="flex flex-col gap-3">
              <Eyebrow>shadcn registry</Eyebrow>
              <h2 className="max-w-2xl font-display text-3xl tracking-tight text-ink sm:text-4xl">
                Or just take the components.
              </h2>
              <p className="max-w-xl text-base leading-relaxed text-ink-muted">
                Every piece of the dashboard is a shadcn-installable component. Add one to your own
                app — no lintscope dependency, just the source, typed against{' '}
                <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[13px] text-ink">
                  @lintscope/schema
                </code>
                .
              </p>
            </div>

            <ul className="mt-10 grid gap-5 sm:grid-cols-2">
              {COMPONENTS.map((c) => (
                <li
                  key={c.name}
                  className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card transition-colors hover:border-line-strong"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-mono text-sm font-semibold text-ink">{c.title}</h3>
                    {c.needs ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
                        <span aria-hidden className="text-accent">
                          ⌐
                        </span>
                        needs {c.needs}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] uppercase tracking-wide text-ok">
                        zero deps
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-ink-muted">{c.description}</p>
                  <CommandChip
                    prefix=""
                    command={`npx shadcn add https://lintscope.dev/r/${c.name}.json`}
                    className="mt-auto text-[13px]"
                  />
                </li>
              ))}
            </ul>
          </section>

          {/* ------------------------------------------------ diagnostic close-up */}
          <section className="border-t border-line py-20">
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div className="flex flex-col gap-4">
                <Eyebrow>One diagnostic, up close</Eyebrow>
                <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
                  Every detail the linter gave you — legible.
                </h2>
                <p className="max-w-md text-base leading-relaxed text-ink-muted">
                  Rule id with a link to its docs, the exact line and column, the source linter, and
                  a clear marker when a fix is available. No truncation, no scrolling a log.
                </p>
              </div>
              <div className="relative">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-6 rounded-3xl bg-accent/10 blur-3xl"
                />
                <div className="relative rounded-xl border border-line-strong bg-surface p-4 shadow-card sm:p-5">
                  <DiagnosticCard diagnostic={sampleDiagnostic} />
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------- cta */}
          <section className="pb-20">
            <div className="relative overflow-hidden rounded-2xl border border-accent-line bg-accent-soft p-10 text-center sm:p-14">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
              />
              <div className="relative flex flex-col items-center gap-6">
                <h2 className="max-w-xl font-display text-3xl tracking-tight text-ink sm:text-4xl">
                  Stop scrolling terminal output.
                </h2>
                <p className="max-w-md text-base text-ink-muted">
                  One command opens a dashboard for whatever linters your project already runs.
                </p>
                <CommandChip command={STUDIO_CMD} className="w-full max-w-sm bg-surface" />
                <a
                  href={GITHUB_URL}
                  className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  Star it on GitHub →
                </a>
              </div>
            </div>
          </section>
        </main>

        {/* -------------------------------------------------------- footer */}
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="h-4 w-4 rounded-[4px] bg-accent" />
              <span className="font-mono text-sm font-semibold text-ink">lintscope</span>
              <span className="text-sm text-ink-faint">— a polished UI for your linter</span>
            </div>
            <div className="flex items-center gap-5 text-sm text-ink-muted">
              <a href="#components" className="hover:text-ink">
                Components
              </a>
              <a href="#how" className="hover:text-ink">
                How it works
              </a>
              <a href={GITHUB_URL} className="hover:text-ink">
                GitHub ↗
              </a>
            </div>
          </div>
          <div className="border-t border-line">
            <p className="mx-auto max-w-6xl px-6 py-5 font-mono text-xs text-ink-faint">
              MIT licensed · Built in public · schemaVersion {sampleReport.schemaVersion}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
