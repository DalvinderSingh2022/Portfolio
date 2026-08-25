import { profile, socials, stats } from "../data";
import { useTypewriter } from "./hooks";
import {
  GithubIcon,
  LinkedinIcon,
  MailIcon,
  DownloadIcon,
  MapPinIcon,
  ArrowIcon,
} from "./Icons";

const socialLinks = [
  { href: socials.github, label: "GitHub", Icon: GithubIcon },
  { href: socials.linkedin, label: "LinkedIn", Icon: LinkedinIcon },
  { href: socials.email, label: "Email", Icon: MailIcon },
];

export default function Hero() {
  const typed = useTypewriter(profile.roles);

  return (
    <section
      id="home"
      className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 pb-16 pt-28 sm:px-8"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left — intro */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-850/60 px-4 py-1.5 text-sm text-soft/80 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Available for opportunities
          </div>

          <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Hi, I'm <span className="text-gradient">Dalvinder</span>.
          </h1>

          <p className="mt-4 flex h-9 items-center font-mono text-xl text-soft sm:text-2xl">
            <span className="text-accent">&gt;</span>
            <span className="ml-2 text-white">{typed}</span>
            <span className="cursor-blink ml-0.5 text-accent">_</span>
          </p>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-soft/85">
            I build scalable, real-time web applications with the{" "}
            <span className="font-semibold text-white">MERN stack</span>. From
            multiplayer games over WebSockets to JWT-secured dashboards — I turn
            ideas into fast, responsive products.
          </p>

          <div className="mt-4 flex items-center gap-2 text-sm text-soft/70">
            <MapPinIcon width={16} height={16} className="text-accent" />
            {profile.location}
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#projects"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-5 py-3 font-semibold text-ink-950 shadow-lg shadow-accent/25 transition-transform hover:-translate-y-0.5"
            >
              View my work
              <ArrowIcon
                width={18}
                height={18}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
            <a
              href={profile.resume}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-ink-850/60 px-5 py-3 font-semibold text-white backdrop-blur transition-colors hover:border-accent/50 hover:bg-ink-800"
            >
              <DownloadIcon width={18} height={18} />
              Résumé
            </a>
          </div>

          {/* Socials */}
          <div className="mt-8 flex items-center gap-3">
            {socialLinks.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("mailto") ? undefined : "_blank"}
                rel="noreferrer"
                aria-label={label}
                className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-850/60 text-soft transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent"
              >
                <Icon />
              </a>
            ))}
          </div>
        </div>

        {/* Right — avatar / terminal card */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="animate-float">
            <div className="card-glow overflow-hidden rounded-2xl border border-line bg-ink-850/70 shadow-2xl shadow-black/40 backdrop-blur">
              {/* window bar */}
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                <span className="h-3 w-3 rounded-full bg-green-400/80" />
                <span className="ml-2 font-mono text-xs text-soft/60">
                  developer.js
                </span>
              </div>

              <div className="flex flex-col items-center px-6 py-8">
                <div className="relative">
                  <div className="absolute -inset-2 animate-spin-slow rounded-full bg-gradient-to-tr from-accent via-transparent to-accent-2 opacity-60 blur-md" />
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    loading="eager"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://avatars.githubusercontent.com/u/110463060?v=4";
                    }}
                    className="relative h-32 w-32 rounded-full border-2 border-ink-700 object-cover"
                  />
                </div>
                <p className="mt-5 text-lg font-bold text-white">
                  {profile.name}
                </p>
                <p className="text-sm text-accent">{profile.tagline}</p>
              </div>

              <pre className="border-t border-line bg-ink-900/60 px-5 py-4 font-mono text-[13px] leading-relaxed text-soft/80">
                {`const dev = {
  role: `}
                <span className="text-emerald-300">'Full Stack'</span>
                {`,
  stack: `}
                <span className="text-accent">['React','Node']</span>
                {`,
  open: `}
                <span className="text-amber-300">true</span>
                {`
}`}
              </pre>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-line bg-ink-850/50 px-2 py-3 text-center backdrop-blur"
              >
                <div className="text-xl font-extrabold text-gradient">
                  {s.value}
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-soft/60">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
