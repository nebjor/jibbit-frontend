"use client";

import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { buildIndex, search, type SearchDoc } from "@/lib/search/engine";
import { formatMoney } from "@/lib/format";
import styles from "./SearchBox.module.css";

/**
 * Instant-search combobox (ARIA 1.2 pattern: role="combobox" on the input,
 * options addressed via aria-activedescendant so DOM focus never leaves the
 * input).
 *
 * The entire index arrives as a prop from the server (`SearchBar`) — searching
 * is a local, synchronous function call, so there is NO debounce on the search
 * itself: with a catalogue in the low hundreds a keystroke costs well under a
 * millisecond, and any debounce would only add perceived latency. The query
 * runs through `useDeferredValue`, so typing can never be blocked by
 * rendering, and results swap atomically (no intermediate empty state, no
 * flicker). Only the SCREEN-READER announcement is debounced, so assistive
 * tech is not spammed on every keystroke.
 *
 * No-JS fallback: the input sits in a plain GET form posting to /suche.
 */

const MIN_QUERY = 2;
const MAX_SUGGESTIONS = 8;
const ANNOUNCE_DELAY_MS = 400;

/** Trails `value` by `ms` — the screen-reader announcement uses this so it is
 * not re-spoken on every keystroke while results update instantly. */
function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function SearchBox({ docs }: { docs: SearchDoc[] }) {
  const router = useRouter();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // The keyboard cursor is BOUND to the query it was set for: a new query
  // yields -1 without any reset effect, so it can never point at a stale row.
  const [cursor, setCursor] = useState<{ q: string; i: number }>({
    q: "",
    i: -1,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Typing updates `query` immediately; the (cheap) search and list render
  // follow via the deferred value without ever blocking a keystroke.
  const deferredQuery = useDeferredValue(query);
  const trimmed = deferredQuery.trim();
  const ready = trimmed.length >= MIN_QUERY;

  const index = useMemo(() => buildIndex(docs), [docs]);
  const hits = useMemo(
    () => (ready ? search(index, trimmed) : []),
    [index, trimmed, ready],
  );

  const suggestions = hits.slice(0, MAX_SUGGESTIONS);
  // The "show all" row is a real option so it is reachable by arrow keys.
  const optionCount = suggestions.length + (hits.length > 0 ? 1 : 0);
  const expanded = open && ready;
  const allUrl = `/suche?q=${encodeURIComponent(trimmed)}`;

  const active = cursor.q === trimmed ? cursor.i : -1;
  const setActive = (next: number | ((prev: number) => number)) =>
    setCursor((prev) => {
      const prevIdx = prev.q === trimmed ? prev.i : -1;
      return {
        q: trimmed,
        i: typeof next === "function" ? next(prevIdx) : next,
      };
    });

  // Debounced result-count announcement for screen readers.
  const announcement = useDebouncedValue(
    expanded
      ? hits.length === 0
        ? "Keine Treffer"
        : hits.length === 1
          ? "1 Treffer"
          : `${hits.length} Treffer`
      : "",
    ANNOUNCE_DELAY_MS,
  );

  // Keep the active option visible when arrowing through a scrolled list.
  useEffect(() => {
    if (active < 0) return;
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" });
    // optionId is stable (derived from useId).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function go(href: string) {
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    router.push(href);
  }

  function hrefFor(i: number): string {
    return i < suggestions.length
      ? `/products/${suggestions[i].doc.handle}`
      : allUrl;
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        if (optionCount > 0) setActive((a) => (a + 1) % optionCount);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (optionCount > 0)
          setActive((a) => (a <= 0 ? optionCount - 1 : a - 1));
        break;
      case "Enter":
        if (expanded && active >= 0) {
          e.preventDefault();
          go(hrefFor(active));
        }
        // Otherwise the form's onSubmit handles it (-> results page).
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        } else if (query) {
          setQuery("");
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (ready) go(allUrl);
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <form action="/suche" role="search" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          type="search"
          name="q"
          className={styles.input}
          placeholder="Suchen …"
          aria-label="Produkte suchen"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </form>

      <p role="status" aria-live="polite" className="srOnly">
        {announcement}
      </p>

      {expanded && (
        <div className={styles.panel}>
          {hits.length === 0 ? (
            <div className={styles.empty}>
              <p>
                Keine Treffer für <strong>«{trimmed}»</strong>.
              </p>
              <p className={styles.emptyHint}>
                Tippfehler sind okay — wir suchen unscharf. Vielleicht führen
                wir den Artikel aber schlicht nicht.
              </p>
            </div>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Suchvorschläge" className={styles.list}>
              {suggestions.map((hit, i) => (
                <li
                  key={hit.doc.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  className={styles.option}
                  // preventDefault keeps focus in the input so the blur
                  // handler cannot close the panel before the click lands.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(hrefFor(i))}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className={styles.optionText}>
                    {hit.doc.brand && (
                      <span className={styles.optionBrand}>
                        {hit.doc.brand}
                      </span>
                    )}
                    <span className={styles.optionTitle}>{hit.doc.title}</span>
                  </span>
                  <span className={`${styles.optionPrice} tnum`}>
                    {formatMoney(hit.doc.price, hit.doc.currency)}
                  </span>
                </li>
              ))}
              <li
                id={optionId(suggestions.length)}
                role="option"
                aria-selected={active === suggestions.length}
                className={styles.showAll}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => go(allUrl)}
                onMouseEnter={() => setActive(suggestions.length)}
              >
                Alle {hits.length} Treffer anzeigen
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
