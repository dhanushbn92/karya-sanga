"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LessonBody } from "@/components/lessons/lesson-body";

/**
 * Fullscreen, keyboard-driven presenter view.
 *
 * Keys:
 *   ←  / ↑  / PageUp     → previous
 *   →  / ↓  / Space / PageDown / Enter  → next
 *   Home → first  /  End → last
 *   F → request fullscreen (browser)
 *   Esc → exit fullscreen
 *
 * Reuses LessonBody for markdown → React so code blocks and tables look
 * identical to the reader view.
 */
export function PresenterDeck({
  slides,
  lessonTitle,
  lessonModule,
  lessonId,
}: {
  slides: string[];
  lessonTitle: string;
  lessonModule: string;
  lessonId: string;
}) {
  const [index, setIndex] = useState(0);
  const total = slides.length;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.max(0, Math.min(total - 1, i + delta)));
    },
    [total],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack typing in a text field (no inputs here right now,
      // but kept defensive for future).
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          e.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          e.preventDefault();
          go(-1);
          break;
        case "Home":
          e.preventDefault();
          setIndex(0);
          break;
        case "End":
          e.preventDefault();
          setIndex(total - 1);
          break;
        case "f":
        case "F":
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            document.documentElement
              .requestFullscreen()
              .catch(() => {});
          }
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  if (total === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center text-on-surface">
        <p className="mono-label text-on-surface-variant">
          This lesson has no slide content yet.
        </p>
        <Link
          href={`/lessons/${lessonId}`}
          className="mono-label mt-4 inline-flex items-center gap-1 rounded-full border border-white/20 px-4 py-1.5 text-on-surface-variant hover:border-primary hover:text-primary"
        >
          ← Back to lesson
        </Link>
      </main>
    );
  }

  const current = slides[index];
  const numLabel = String(index + 1).padStart(2, "0");

  return (
    <main className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/anaadi-logo-mark.png"
            alt=""
            aria-hidden="true"
            className="h-9 w-auto object-contain"
          />
          <div className="leading-tight">
            <div className="text-base font-bold text-primary">
              Karya Sanga
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              {lessonModule}
            </div>
          </div>
        </div>
        <Link
          href={`/lessons/${lessonId}`}
          className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-4 py-1.5 text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
          Exit presentation
        </Link>
      </header>

      {/* Slide */}
      <section className="relative flex flex-1 items-center justify-center px-6 py-8">
        <div className="absolute right-10 top-2 select-none text-[140px] font-black leading-none text-on-surface/5">
          {numLabel}
        </div>
        <article className="glass-card saffron-glow relative z-10 max-h-[80vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-white/10 p-10">
          <div className="mono-label mb-4 text-primary">
            Slide {numLabel} / {String(total).padStart(2, "0")} ·{" "}
            {lessonTitle}
          </div>
          <LessonBody markdown={current} />
        </article>
      </section>

      {/* Bottom bar */}
      <footer className="flex items-center justify-between gap-4 border-t border-white/5 px-6 py-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous slide"
          className="mono-label inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-30"
        >
          <span className="material-symbols-outlined text-[20px]">
            chevron_left
          </span>
        </button>

        <div className="mono-label flex items-center gap-3 text-on-surface-variant">
          <span>{numLabel}</span>
          <div className="h-1 w-32 rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${((index + 1) / total) * 100}%`,
              }}
            />
          </div>
          <span>{String(total).padStart(2, "0")}</span>
          <span className="hidden text-[10px] uppercase tracking-wider opacity-60 md:inline">
            · Press SPACE to advance
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-[18px]">
              fullscreen
            </span>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === total - 1}
            aria-label="Next slide"
            className="mono-label inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[20px]">
              chevron_right
            </span>
          </button>
        </div>
      </footer>
    </main>
  );
}
