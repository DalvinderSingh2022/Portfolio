import { projects, moreProjects, socials } from "../data";
import { SectionHeading, Reveal } from "./Section";
import { ExternalIcon, CodeIcon, ArrowIcon } from "./Icons";

function ProjectCard({ p, delay }) {
  return (
    <Reveal
      className="card-glow group flex flex-col rounded-2xl border border-line bg-ink-850/50 p-6 backdrop-blur transition-transform duration-300 hover:-translate-y-1"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-800 font-mono text-lg font-bold text-gradient">
          {p.title[0]}
        </div>
        {p.highlight && (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            {p.highlight}
          </span>
        )}
      </div>

      <h3 className="text-xl font-bold text-white transition-colors group-hover:text-accent">
        {p.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-soft/80">
        {p.blurb}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {p.tags.map((t) => (
          <span
            key={t}
            className="rounded-md bg-ink-800/80 px-2.5 py-1 font-mono text-[11px] text-soft/70"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        <a
          href={p.live}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-colors hover:text-accent"
        >
          <ExternalIcon width={16} height={16} />
          Live Demo
        </a>
        <span className="text-line">|</span>
        <a
          href={p.code}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-soft/80 transition-colors hover:text-white"
        >
          <CodeIcon width={16} height={16} />
          Code
        </a>
      </div>
    </Reveal>
  );
}

export default function Projects() {
  const featured = projects.filter((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);

  return (
    <section
      id="projects"
      className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32"
    >
      <SectionHeading
        index="03"
        subtitle="Things I've built"
        title="Featured Projects"
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {featured.map((p, i) => (
          <ProjectCard key={p.title} p={p} delay={i * 80} />
        ))}
      </div>

      <Reveal className="mt-16">
        <h3 className="mb-6 text-lg font-bold text-white">More projects</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {rest.map((p, i) => (
            <ProjectCard key={p.title} p={p} delay={i * 80} />
          ))}
        </div>
      </Reveal>

      {/* Small demo strip + view all */}
      <Reveal className="mt-14 rounded-2xl border border-line bg-ink-850/40 p-6 backdrop-blur">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-white">
              Plus a few more experiments
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {moreProjects.map((m) => (
                <a
                  key={m.name}
                  href={m.live}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-line bg-ink-800/60 px-3 py-1.5 text-sm text-soft/80 transition-colors hover:border-accent/50 hover:text-white"
                >
                  {m.name} ↗
                </a>
              ))}
            </div>
          </div>
          <a
            href={socials.github}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex shrink-0 items-center gap-2 rounded-xl border border-line bg-ink-800/70 px-5 py-3 font-semibold text-white transition-colors hover:border-accent/50"
          >
            All repos on GitHub
            <ArrowIcon
              width={18}
              height={18}
              className="text-accent transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
