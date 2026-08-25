import { experience } from "../data";
import { SectionHeading, Reveal } from "./Section";

export default function Experience() {
  return (
    <section
      id="experience"
      className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32"
    >
      <SectionHeading
        index="04"
        subtitle="Where I've worked"
        title="Experience"
      />

      <div className="relative">
        {/* vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/60 via-line to-transparent md:left-[9px]" />

        <div className="space-y-8">
          {experience.map((job, i) => (
            <Reveal
              key={job.company}
              className="relative pl-8 md:pl-12"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {/* node */}
              <span
                className={`absolute left-0 top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 ${
                  job.current
                    ? "border-accent bg-accent/20"
                    : "border-line bg-ink-800"
                } md:h-5 md:w-5`}
              >
                {job.current && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                )}
              </span>

              <div className="card-glow rounded-2xl border border-line bg-ink-850/50 p-6 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-white">
                    {job.role}{" "}
                    <span className="text-accent">@ {job.company}</span>
                  </h3>
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${
                      job.current
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-ink-800 text-soft/70"
                    }`}
                  >
                    {job.period}
                  </span>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {job.points.map((pt) => (
                    <li
                      key={pt}
                      className="flex gap-3 text-sm leading-relaxed text-soft/85"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
