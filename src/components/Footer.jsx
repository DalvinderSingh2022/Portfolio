import { profile, socials } from "../data";
import { GithubIcon, LinkedinIcon, MailIcon } from "./Icons";

const links = [
  { href: socials.github, label: "GitHub", Icon: GithubIcon },
  { href: socials.linkedin, label: "LinkedIn", Icon: LinkedinIcon },
  { href: socials.email, label: "Email", Icon: MailIcon },
];

export default function Footer() {
  return (
    <footer className="border-t border-line/70 bg-ink-950/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
        <p className="text-sm text-soft/60">
          © {new Date().getFullYear()} {profile.name}.
        </p>
        <div className="flex items-center gap-2">
          {links.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith("mailto") ? undefined : "_blank"}
              rel="noreferrer"
              aria-label={label}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-ink-850/60 text-soft/70 transition-colors hover:border-accent/50 hover:text-accent"
            >
              <Icon width={17} height={17} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
