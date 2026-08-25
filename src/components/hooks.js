import { useEffect, useRef, useState } from "react";

/**
 * Adds `is-visible` to a `.reveal` element the first time it scrolls into view.
 * Returns a ref to attach to the element.
 */
export function useReveal(options = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px", ...options },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [options]);
  return ref;
}

/** Tracks which section id is currently active in the viewport. */
export function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const observers = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setActive(id);
          });
        },
        { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
      );
      io.observe(el);
      observers.push(io);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [ids]);
  return active;
}

/** Typewriter effect that cycles through a list of words. */
export function useTypewriter(
  words,
  { typing = 90, deleting = 45, pause = 1600 } = {},
) {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [deleteMode, setDeleteMode] = useState(false);

  useEffect(() => {
    const word = words[idx % words.length];
    let timeout;

    if (!deleteMode && text === word) {
      timeout = setTimeout(() => setDeleteMode(true), pause);
    } else if (deleteMode && text === "") {
      setDeleteMode(false);
      setIdx((i) => i + 1);
    } else {
      timeout = setTimeout(
        () => {
          setText((t) =>
            deleteMode ? t.slice(0, -1) : word.slice(0, t.length + 1),
          );
        },
        deleteMode ? deleting : typing,
      );
    }
    return () => clearTimeout(timeout);
  }, [text, deleteMode, idx, words, typing, deleting, pause]);

  return text;
}
