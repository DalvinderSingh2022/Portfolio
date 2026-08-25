import { profile, socials } from "../data";
import { SectionHeading, Reveal } from "./Section";
import { GithubIcon, LinkedinIcon, MailIcon, ArrowIcon } from "./Icons";

const channels = [
  { href: socials.email, label: "Email", value: profile.email, Icon: MailIcon },
  {
    href: socials.linkedin,
    label: "LinkedIn",
    value: "/in/dalvindersingh2019",
    Icon: LinkedinIcon,
  },
  {
    href: socials.github,
    label: "GitHub",
    value: "@DalvinderSingh2022",
    Icon: GithubIcon,
  },
];

export default function Contact() {
  return (
    <section
      id="contact"
      className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32"
    >
      <SectionHeading
        index="05"
        subtitle="Say hello"
        title="Let's build something"
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <Reveal className="card-glow rounded-3xl border border-line bg-gradient-to-br from-ink-850/80 to-ink-900/80 p-8 backdrop-blur md:p-10">
          <h3 className="text-2xl font-bold text-white sm:text-3xl">
            Have a role or project in mind?
          </h3>
          <p className="mt-4 text-lg leading-relaxed text-soft/85">
            I'm open to full-stack and front-end opportunities, freelance work,
            and interesting collaborations. My inbox is always open — I'll get
            back to you as soon as I can.
          </p>
          <a
            href={socials.email}
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-3.5 font-semibold text-ink-950 shadow-lg shadow-accent/25 transition-transform hover:-translate-y-0.5"
          >
            Send me an email
            <ArrowIcon
              width={18}
              height={18}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
          <p className="mt-6 font-mono text-sm text-soft/60">
            or call · {profile.phone}
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-4">
          {channels.map((c, i) => (
            <Reveal key={c.label} style={{ transitionDelay: `${i * 80}ms` }}>
              <a
                href={c.href}
                target={c.href.startsWith("mailto") ? undefined : "_blank"}
                rel="noreferrer"
                className="card-glow group flex h-full flex-col justify-between rounded-2xl border border-line bg-ink-850/50 p-5 backdrop-blur transition-transform hover:-translate-y-1"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-800 text-soft transition-colors group-hover:border-accent/50 group-hover:text-accent">
                  <c.Icon />
                </span>
                <div className="mt-6">
                  <p className="text-sm font-semibold text-white">{c.label}</p>
                  <p className="mt-0.5 break-all font-mono text-xs text-soft/60">
                    {c.value}
                  </p>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
