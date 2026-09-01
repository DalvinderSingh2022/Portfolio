import { profile, education } from "../data";
import { SectionHeading, Reveal } from "./Section";
import { SparkIcon } from "./Icons";

export default function About() {
  return (
    <section
      id="about"
      className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32"
    >
      <SectionHeading index="01" subtitle="Get to know me" title="About" />

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="space-y-5 text-lg leading-relaxed text-soft/85">
          <p>{profile.summary}</p>
          <p>
            Currently I'm a{" "}
            <span className="font-semibold text-white">
              Full Stack Developer at{" "}
              <a
                href="https://www.linkedin.com/company/odisoft-technology-pvt-ltd"
                className="underline decoration-accent hover:translate-2"
              >
                Odisoft Technology
              </a>
            </span>
            , where I architect front-end features in React and push for fast,
            consistent experiences across devices. I care about clean code,
            thoughtful UX, and shipping things that actually work in production.
          </p>
          <p>
            Outside of work you'll find me sharpening my{" "}
            <span className="font-semibold text-white">
              Data Structures &amp; Algorithms
            </span>{" "}
            and turning weekend ideas into small, polished projects.
          </p>
        </Reveal>

        <Reveal className="space-y-4" style={{ transitionDelay: "120ms" }}>
          <h3 className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-accent">
            <SparkIcon width={16} height={16} />
            Education
          </h3>
          {education.map((e) => (
            <div
              key={e.degree}
              className="card-glow rounded-2xl border border-line bg-ink-850/50 p-5 backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-semibold text-white">{e.degree}</h4>
                <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                  {e.detail}
                </span>
              </div>
              <p className="mt-1 text-sm text-soft/80">{e.school}</p>
              <p className="mt-1 font-mono text-xs text-soft/55">{e.period}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
