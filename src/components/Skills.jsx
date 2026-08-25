import { skills } from "../data";
import { SectionHeading, Reveal } from "./Section";

export default function Skills() {
  return (
    <section
      id="skills"
      className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32"
    >
      <SectionHeading
        index="02"
        subtitle="What I work with"
        title="Skills & Tools"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {skills.map((group, i) => (
          <Reveal
            key={group.group}
            className="card-glow rounded-2xl border border-line bg-ink-850/50 p-6 backdrop-blur"
            style={{ transitionDelay: `${i * 90}ms` }}
          >
            <h3 className="mb-4 flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-accent">
              <span className="text-soft/40">0{i + 1}</span>
              {group.group}
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {group.items.map((item) => (
                <span
                  key={item}
                  className="rounded-lg border border-line bg-ink-800/70 px-3 py-1.5 text-sm text-soft transition-colors hover:border-accent/50 hover:text-white"
                >
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
