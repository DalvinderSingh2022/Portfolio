import { useEffect, useState } from "react";
import { useActiveSection } from "./hooks";
import { MenuIcon, CloseIcon } from "./Icons";

const links = [
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useActiveSection(links.map((l) => l.id));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-line/70 bg-ink-950/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a
          href="#home"
          className="group flex items-center gap-2 font-mono text-lg font-bold text-white"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-ink-850 text-gradient transition-transform group-hover:-translate-y-0.5">
            DS
          </span>
          <span className="hidden sm:inline">
            dalvinder<span className="text-accent">.</span>dev
          </span>
        </a>

        {/* Desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <ul className="flex items-center gap-1 rounded-full border border-line/70 bg-ink-850/40 p-1 backdrop-blur">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  className={`group relative block rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    active === l.id
                      ? "text-ink-950"
                      : "text-soft/70 hover:text-white"
                  }`}
                >
                  {active === l.id && (
                    <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-accent to-accent-2 shadow-lg shadow-accent/30 transition-all" />
                  )}
                  {/* hover chip for inactive items */}
                  {active !== l.id && (
                    <span className="absolute inset-0 -z-10 scale-90 rounded-full bg-white/5 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100" />
                  )}
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            className="rounded-full bg-gradient-to-r from-accent to-accent-2 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
          >
            Let's talk
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-ink-850 text-white md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden border-t border-line bg-ink-950/95 backdrop-blur-xl transition-[max-height] duration-300 md:hidden ${
          open ? "max-h-96" : "max-h-0"
        }`}
      >
        <ul className="flex flex-col gap-1 px-5 py-4">
          {links.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-4 py-3 text-base font-medium ${
                  active === l.id ? "bg-white/5 text-white" : "text-soft/80"
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
