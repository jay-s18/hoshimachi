/**
 * English / Japanese. English text is the key: t("Best odds") returns the Japanese when the page is in Japanese,
 * and the English itself otherwise (or when a translation is missing). Placeholders are written {name}:
 *     t("{n} regions pass your filters", { n: 42 })
 *
 * Static text in index.html is marked with data-i18n (text), data-i18n-html (markup), data-i18n-tip, -title,
 * -ph (placeholder) and -aria (aria-label); the English stays in the HTML and is restored when switching back.
 * Long prose (the How it works dialog) is written in both languages in index.html as [data-lang] blocks, and
 * CSS shows the one matching <html lang>.
 *
 * Names: regions, towns, prefectures and spots carry both an English and a Japanese name in the data; nm()
 * picks the one for the current language.
 */
import { JA } from "./i18n-ja.js";

const STORE_KEY = "hoshimachi.lang";
const listeners = [];

/** "en" | "ja": from a shared link (?lang=ja), then the user's last choice, then the browser's language. */
export let lang = (() => {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "ja") return q;
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (s === "en" || s === "ja") return s;
  } catch {
    // storage blocked: fall through to the browser language
  }
  return /^ja\b/i.test(navigator.language || "") ? "ja" : "en";
})();

export const isJa = () => lang === "ja";

/** Translate English text `en`, filling {placeholders} from vars. */
export function t(en, vars) {
  let s = (lang === "ja" && JA[en]) || en;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

/** The name for the current language: nm("Lake Mashu", "摩周湖") -> "摩周湖" in Japanese. */
export const nm = (en, ja) => (lang === "ja" && ja ? ja : en);

/** The other language's name, shown smaller beside the main one ("" when they are the same). */
export const nm2 = (en, ja) => {
  const o = lang === "ja" ? en : ja;
  return o && o !== nm(en, ja) ? o : "";
};

/** Split "Yokohama City (横浜市)" into the name for the current language. */
export function nmPair(s) {
  const m = /^(.*?) \((.+)\)$/.exec(s || "");
  return m ? nm(m[1], m[2]) : s;
}

/** Call fn after every language change (to redraw text built in JavaScript). */
export const onLang = (fn) => listeners.push(fn);

const ATTRS = [
  ["i18nTip", "data-tip"],
  ["i18nTitle", "title"],
  ["i18nPh", "placeholder"],
  ["i18nAria", "aria-label"],
];
const originals = new WeakMap(); // element -> its English text and attributes, read once from the HTML

/** Translate the static text in the page. */
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root
    .querySelectorAll("[data-i18n], [data-i18n-html], [data-i18n-tip], [data-i18n-title], [data-i18n-ph], [data-i18n-aria]")
    .forEach((el) => {
      if (!originals.has(el)) {
        const o = {
          text: el.dataset.i18n !== undefined ? el.textContent.trim() : null,
          html: el.dataset.i18nHtml !== undefined ? el.innerHTML : null,
        };
        for (const [, attr] of ATTRS) o[attr] = el.getAttribute(attr);
        originals.set(el, o);
      }
      const o = originals.get(el);
      if (o.text !== null) el.textContent = t(o.text);
      if (o.html !== null) el.innerHTML = lang === "ja" && JA[el.dataset.i18nHtml] ? JA[el.dataset.i18nHtml] : o.html;
      for (const [key, attr] of ATTRS) if (el.dataset[key] !== undefined && o[attr] !== null) el.setAttribute(attr, t(o[attr]));
    });
  const title = document.querySelector("title");
  if (!originals.has(title)) originals.set(title, { text: title.textContent });
  title.textContent = t(originals.get(title).text);
}

/** Switch language, remember it, and redraw. */
export function setLang(l) {
  if (l === lang) return;
  lang = l;
  try {
    localStorage.setItem(STORE_KEY, l);
  } catch {
    // not remembered; the link still carries it
  }
  applyStatic();
  listeners.forEach((fn) => fn());
}
