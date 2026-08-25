import { useReveal } from "./hooks";

export function SectionHeading({ index, title, subtitle }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="reveal mb-12 md:mb-16">
      <div className="flex items-center gap-3 text-sm font-mono text-accent">
        <span className="opacity-70">{index}</span>
        <span className="h-px w-8 bg-accent/50" />
        <span className="uppercase tracking-[0.2em] text-soft/70">
          {subtitle}
        </span>
      </div>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
        {title}
      </h2>
    </div>
  );
}

export function Reveal({ as: Tag = "div", className = "", style, children }) {
  const ref = useReveal();

  return (
    <Tag ref={ref} className={`reveal ${className}`} style={style}>
      {children}
    </Tag>
  );
}
