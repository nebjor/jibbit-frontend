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
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { buildIndex, search, type SearchDoc } from "@/lib/search/engine";
import { displayTitle } from "@/lib/search/display";
import { formatMoney } from "@/lib/format";
import styles from "./SearchBox.module.css";

/**
 * Instant-search combobox (ARIA 1.2 pattern: role="combobox" on the input,
 * options addressed via aria-activedescendant so DOM focus never leaves the
 * input) — in TWO presentations from ONE DOM tree:
 *
 *  - Below 900px (the shop's main case, 90–95% of visits are phones) the
 *    header shows only a 44px magnifier button. Tapping it opens a
 *    FULL-SCREEN SEARCH LAYER: input at the top, results filling the rest.
 *    Chosen over a permanently visible field because header height is the
 *    scarcest resource on a phone — a squeezed 150px field costs a row and
 *    still cannot show readable results. Full screen gives the input AND
 *    every suggestion the entire viewport width.
 *
 *    The layer's height follows `visualViewport` (CSS var --search-vh), so
 *    when the on-screen keyboard is up the results list ends ABOVE the
 *    keyboard instead of running underneath it — the classic mobile-search
 *    failure this exists to prevent. Focus moves into the input inside the
 *    tap's own event turn (flushSync + .focus()), which is what makes iOS
 *    actually raise the keyboard.
 *
 *  - From 900px the same input renders inline in the header, wide (~60–70%
 *    of the bar), with the classic dropdown panel.
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
 * (Without JS the mobile trigger cannot open the layer — the /suche page
 * carries its own plain form, and the category links still work.)
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
  /** The mobile full-screen layer. Never true at ≥900px (trigger hidden,
   * and a resize across the breakpoint closes it — see the effect below). */
  const [layerOpen, setLayerOpen] = useState(false);
  // The keyboard cursor is BOUND to the query it was set for: a new query
  // yields -1 without any reset effect, so it can never point at a stale row.
  const [cursor, setCursor] = useState<{ q: string; i: number }>({
    q: "",
    i: -1,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

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

  /* ---- Mobile layer plumbing ------------------------------------------ */

  // While the layer is up, its height must track the VISUAL viewport, not
  // the layout viewport: when the on-screen keyboard rises, visualViewport
  // shrinks and the layer (flex column: bar on top, list below) shrinks with
  // it — so the last visible suggestion sits above the keyboard, never
  // under it. Fallback without the API: 100dvh (see the CSS).
  useEffect(() => {
    if (!layerOpen) return;
    const vv = window.visualViewport;
    const el = shellRef.current;
    if (!vv || !el) return;
    const update = () =>
      el.style.setProperty("--search-vh", `${Math.round(vv.height)}px`);
    update();
    vv.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      el.style.removeProperty("--search-vh");
    };
  }, [layerOpen]);

  // The page behind the layer must not scroll (a second scroll surface on a
  // 320px screen means mis-taps and a lost scroll position).
  useEffect(() => {
    if (!layerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [layerOpen]);

  // Rotating a phone / resizing a window across the breakpoint while the
  // layer is open would leave `layerOpen` orphaned (the trigger is hidden
  // ≥900px). Close it; the inline field takes over.
  useEffect(() => {
    if (!layerOpen) return;
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = () => {
      if (mq.matches) setLayerOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [layerOpen]);

  function openLayer() {
    // flushSync so the layer EXISTS in the DOM before .focus() — and .focus()
    // stays inside the tap's own event turn, which is the condition under
    // which iOS raises the on-screen keyboard for a programmatic focus.
    flushSync(() => {
      setLayerOpen(true);
      setOpen(true);
    });
    inputRef.current?.focus();
  }

  function closeLayer() {
    setLayerOpen(false);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function go(href: string) {
    setOpen(false);
    setLayerOpen(false);
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
        if (layerOpen) {
          // In the layer, Escape means "get me out of search" — one step,
          // not a panel/query/layer ladder. (Also handled at the dialog
          // level for when focus is on the cancel button.)
          e.preventDefault();
          closeLayer();
        } else if (open) {
          e.preventDefault();
          setOpen(false);
        } else if (query) {
          setQuery("");
        }
        break;
      case "Tab":
        if (!layerOpen) setOpen(false);
        // In the layer the dialog-level handler traps Tab.
        break;
    }
  }

  // The layer is a modal dialog with exactly two tab stops (input, cancel);
  // trap Tab between them so focus cannot escape into the page behind.
  function onLayerKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeLayer();
      return;
    }
    if (e.key !== "Tab") return;
    e.preventDefault();
    const target =
      document.activeElement === inputRef.current
        ? cancelRef.current
        : inputRef.current;
    target?.focus();
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
        // Desktop dropdown behaviour. In the layer, dismissing the keyboard
        // blurs the input too — the results must stay browsable then, so the
        // layer only closes via Abbrechen / Escape / navigation.
        if (layerOpen) return;
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      {/* Mobile-only (hidden ≥900px via CSS): the header carries a single
          44px magnifier instead of a squeezed field. */}
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label="Suchen"
        aria-haspopup="dialog"
        aria-expanded={layerOpen}
        onClick={openLayer}
      >
        <svg
          className={styles.triggerIcon}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <line x1="15.5" y1="15.5" x2="21" y2="21" />
        </svg>
      </button>

      <div
        ref={shellRef}
        className={styles.shell}
        data-open={layerOpen || undefined}
        role={layerOpen ? "dialog" : undefined}
        aria-modal={layerOpen ? true : undefined}
        aria-label={layerOpen ? "Produktsuche" : undefined}
        onKeyDown={layerOpen ? onLayerKeyDown : undefined}
      >
        <div className={styles.shellBar}>
          <form
            action="/suche"
            role="search"
            onSubmit={onSubmit}
            className={styles.form}
          >
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
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            onClick={closeLayer}
          >
            Abbrechen
          </button>
        </div>

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
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Suchvorschläge"
                className={styles.list}
              >
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
                      {/* Brand-deduped and WRAPPING (up to two lines): the
                          catalogue's names share long prefixes ("OCB Premium
                          …"), and end-of-line truncation deleted exactly the
                          part that distinguishes them. */}
                      <span className={styles.optionTitle}>
                        {displayTitle(hit.doc.title, hit.doc.brand)}
                      </span>
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
    </div>
  );
}
