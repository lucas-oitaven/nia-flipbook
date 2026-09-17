import { initThemeToggle } from "./theme.js";

const elements = {
  pageTitle: document.querySelector("#page-title"),
  statusText: document.querySelector("#status-text"),
  languageSelect: document.querySelector("#language-select"),
  themeButton: document.querySelector("#theme-button"),
  shelfLead: document.querySelector("#shelf-lead"),
  shelfList: document.querySelector("#shelf-list"),
};

const translations = {
  en: {
    language: "Language",
    pageTitle: "Shelf",
    lead: "Private list of publications. Share only the specific book link.",
    empty: "No books found.",
    unavailable: "Unable to load the book list.",
    books: (count) => `${count} book${count === 1 ? "" : "s"}`,
    open: "Open",
    copy: "Copy link",
    copied: "Copied",
    copyFailed: "Copy failed",
    darkMode: "Dark mode",
    lightMode: "Light mode",
  },
  es: {
    language: "Idioma",
    pageTitle: "Estante",
    lead: "Lista privada de publicaciones. Comparte solo el enlace del libro específico.",
    empty: "No se encontraron libros.",
    unavailable: "No se pudo cargar la lista de libros.",
    books: (count) => `${count} libro${count === 1 ? "" : "s"}`,
    open: "Abrir",
    copy: "Copiar enlace",
    copied: "Copiado",
    copyFailed: "Error al copiar",
    darkMode: "Modo oscuro",
    lightMode: "Modo claro",
  },
};

let language =
  new URLSearchParams(window.location.search).get("lang") ||
  localStorage.getItem("flipbook-language") ||
  "en";
if (!translations[language]) language = "en";

function t(key, ...args) {
  const value = translations[language][key];
  return typeof value === "function" ? value(...args) : value;
}

const syncThemeButton = initThemeToggle(elements.themeButton, () => ({
  dark: t("darkMode"),
  light: t("lightMode"),
}));

function applyLanguage() {
  document.documentElement.lang = language;
  document.title = t("pageTitle");
  elements.pageTitle.textContent = t("pageTitle");
  elements.languageSelect.value = language;
  elements.languageSelect.setAttribute("aria-label", t("language"));
  elements.shelfLead.textContent = t("lead");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  syncThemeButton();
  renderBooks(loadedBooks);
}

elements.languageSelect.addEventListener("change", (event) => {
  language = event.target.value;
  localStorage.setItem("flipbook-language", language);
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("lang", language);
  window.history.replaceState({}, "", nextUrl);
  applyLanguage();
});

let loadedBooks = null;

function fileNameToTitle(fileName) {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bookUrl(file, title) {
  const url = new URL("./index.html", window.location.href);
  url.searchParams.set("book", file);
  url.searchParams.set("title", title);
  url.searchParams.set("lang", language);
  return url.toString();
}

function renderBooks(books) {
  if (books === null) return;

  if (!books.length) {
    elements.statusText.textContent = "";
    elements.shelfList.innerHTML = `<li class="shelf-item"><span class="shelf-item-title">${escapeHtml(t("empty"))}</span></li>`;
    return;
  }

  elements.statusText.textContent = t("books", books.length);
  elements.shelfList.innerHTML = books
    .map((book, index) => {
      const file = book.file;
      const title = book.title || fileNameToTitle(file);
      return `
        <li class="shelf-item">
          <div>
            <span class="shelf-item-title">${escapeHtml(title)}</span>
            <span class="shelf-item-file">${escapeHtml(file)}</span>
          </div>
          <div class="shelf-actions">
            <a class="text-button" href="${escapeHtml(bookUrl(file, title))}">${escapeHtml(t("open"))}</a>
            <button class="text-button" type="button" data-copy-index="${index}">${escapeHtml(t("copy"))}</button>
          </div>
        </li>
      `;
    })
    .join("");

  elements.shelfList.querySelectorAll("[data-copy-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const book = books[Number(button.dataset.copyIndex)];
      if (!book) return;
      const title = book.title || fileNameToTitle(book.file);
      try {
        await navigator.clipboard.writeText(bookUrl(book.file, title));
        button.textContent = t("copied");
      } catch (error) {
        button.textContent = t("copyFailed");
      }
      window.setTimeout(() => {
        button.textContent = t("copy");
      }, 1600);
    });
  });
}

async function loadBooks() {
  try {
    const response = await fetch("./books/books.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("unavailable");
    }
    const data = await response.json();
    loadedBooks = Array.isArray(data.books) ? data.books : [];
  } catch (error) {
    loadedBooks = [];
    elements.statusText.textContent = "";
    elements.shelfList.innerHTML = `<li class="shelf-item"><span class="shelf-item-title">${escapeHtml(t("unavailable"))}</span></li>`;
    return;
  }

  renderBooks(loadedBooks);
}

applyLanguage();
loadBooks();
