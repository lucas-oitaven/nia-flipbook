import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs";
import { initThemeToggle } from "./theme.js";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs";

const elements = {
  viewer: document.querySelector("#viewer"),
  book: document.querySelector("#book"),
  bookTitle: document.querySelector("#book-title"),
  statusText: document.querySelector("#status-text"),
  loading: document.querySelector("#loading"),
  loadingLabel: document.querySelector("#loading-label"),
  loadingPercent: document.querySelector("#loading-percent"),
  progressBar: document.querySelector("#progress-bar"),
  errorPanel: document.querySelector("#error-panel"),
  errorTitle: document.querySelector("#error-title"),
  errorMessage: document.querySelector("#error-message"),
  errorHint: document.querySelector("#error-hint"),
  firstButton: document.querySelector("#first-button"),
  prevButton: document.querySelector("#prev-button"),
  nextButton: document.querySelector("#next-button"),
  lastButton: document.querySelector("#last-button"),
  fullscreenButton: document.querySelector("#fullscreen-button"),
  pageCounter: document.querySelector("#page-counter"),
  languageSelect: document.querySelector("#language-select"),
  themeButton: document.querySelector("#theme-button"),
};

const translations = {
  en: {
    language: "Language",
    bookControls: "Book controls",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    firstPage: "First page",
    previousPage: "Previous page",
    nextPage: "Next page",
    lastPage: "Last page",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    pdfReader: "PDF reader",
    openBookError: "Unable to open the book.",
    errorHint: "Make sure the PDF is inside the <code>books/</code> folder and that the name used in <code>?book=filename.pdf</code> is correct.",
    footerHint: "Drag the page corner, swipe on mobile, or use the keyboard arrows.",
    preparing: "Preparing…",
    openingPdf: "Opening PDF…",
    downloadingPdf: "Downloading PDF…",
    preparingPages: (current, total) => `Preparing pages… ${current}/${total}`,
    assemblingBook: "Assembling book…",
    ready: "Ready",
    error: "Error",
    pages: (count) => `${count} page${count === 1 ? "" : "s"}`,
    missingFile: (name) => `The file "${name}" was not found.`,
    invalidPdf: "The file found does not appear to be a valid PDF.",
    invalidBookName: 'Invalid book name. Use only the PDF filename, for example "?book=my-book.pdf".',
    missingBook: "Nothing to display.",
    missingBookTitle: "No publication selected.",
    missingBookHint: "Open the specific link you received to view this publication.",
  },
  es: {
    language: "Idioma",
    bookControls: "Controles del libro",
    darkMode: "Modo oscuro",
    lightMode: "Modo claro",
    firstPage: "Primera página",
    previousPage: "Página anterior",
    nextPage: "Página siguiente",
    lastPage: "Última página",
    fullscreen: "Pantalla completa",
    exitFullscreen: "Salir de pantalla completa",
    pdfReader: "Lector de PDF",
    openBookError: "No se pudo abrir el libro.",
    errorHint: "Asegúrate de que el PDF esté dentro de la carpeta <code>books/</code> y que el nombre usado en <code>?book=archivo.pdf</code> sea correcto.",
    footerHint: "Arrastra la esquina de la página, desliza en el móvil o usa las flechas del teclado.",
    preparing: "Preparando…",
    openingPdf: "Abriendo PDF…",
    downloadingPdf: "Descargando PDF…",
    preparingPages: (current, total) => `Preparando páginas… ${current}/${total}`,
    assemblingBook: "Montando libro…",
    ready: "Listo",
    error: "Error",
    pages: (count) => `${count} página${count === 1 ? "" : "s"}`,
    missingFile: (name) => `No se encontró el archivo "${name}".`,
    invalidPdf: "El archivo encontrado no parece ser un PDF válido.",
    invalidBookName: 'Nombre de libro inválido. Usa solo el nombre del PDF, por ejemplo "?book=mi-libro.pdf".',
    missingBook: "No hay nada para mostrar.",
    missingBookTitle: "Ninguna publicación seleccionada.",
    missingBookHint: "Abre el enlace específico que recibiste para ver esta publicación.",
  },
};

let language = new URLSearchParams(window.location.search).get("lang") || localStorage.getItem("flipbook-language") || "en";
if (!translations[language]) language = "en";

function t(key, ...args) {
  const value = translations[language][key];
  return typeof value === "function" ? value(...args) : value;
}

function applyLanguage() {
  document.documentElement.lang = language;
  elements.languageSelect.value = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    const [attribute, key] = element.dataset.i18nAttr.split(":");
    element.setAttribute(attribute, t(key));
  });
  elements.loadingLabel.textContent = t("preparing");
  elements.errorTitle.textContent = currentHintKey === "missingBookHint" ? t("missingBookTitle") : t("openBookError");
  elements.errorHint.innerHTML = currentHintKey === "missingBookHint" ? t("missingBookHint") : t("errorHint");
  elements.languageSelect.setAttribute("aria-label", t("language"));
  syncThemeButton();
  elements.firstButton.setAttribute("aria-label", t("firstPage"));
  elements.firstButton.title = t("firstPage");
  elements.prevButton.setAttribute("aria-label", t("previousPage"));
  elements.prevButton.title = t("previousPage");
  elements.nextButton.setAttribute("aria-label", t("nextPage"));
  elements.nextButton.title = t("nextPage");
  elements.lastButton.setAttribute("aria-label", t("lastPage"));
  elements.lastButton.title = t("lastPage");
  elements.fullscreenButton.textContent = isFullscreenActive() ? t("exitFullscreen") : t("fullscreen");
  if (totalRealPages) {
    elements.statusText.textContent = t("pages", totalRealPages);
  } else if (!elements.errorPanel.hidden && currentHintKey === "missingBookHint") {
    elements.statusText.textContent = "";
  } else if (!elements.errorPanel.hidden) {
    elements.statusText.textContent = t("error");
  } else {
    elements.statusText.textContent = t("preparing");
  }
}

elements.languageSelect.addEventListener("change", (event) => {
  language = event.target.value;
  localStorage.setItem("flipbook-language", language);
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("lang", language);
  window.history.replaceState({}, "", nextUrl);
  applyLanguage();
});

const syncThemeButton = initThemeToggle(elements.themeButton, () => ({
  dark: t("darkMode"),
  light: t("lightMode"),
}));

let pageFlip = null;
let objectUrls = [];
let loadRequestId = 0;
let totalRealPages = 0;
let currentRealPage = 1;
let currentHintKey = "errorHint";
let initialBookName = null;
let cssFullscreen = false;

const params = new URLSearchParams(window.location.search);
const requestedBook = params.get("book");
let bootError = null;

try {
  if (requestedBook) {
    initialBookName = getSafeBookName(requestedBook);
  }
} catch (error) {
  bootError = error;
}

function updatePageTitle(bookName, customTitle) {
  if (!bookName) {
    elements.bookTitle.textContent = "Flipbook";
    document.title = "Flipbook";
    return;
  }

  const title = customTitle?.trim() || fileNameToTitle(bookName);
  elements.bookTitle.textContent = title;
  document.title = `${title} — Flipbook`;
}

updatePageTitle(initialBookName, params.get("title"));
applyLanguage();
disableNavigation(true);

if (initialBookName) {
  loadBook(initialBookName);
} else {
  elements.loading.hidden = true;
  if (bootError) {
    showError(normalizeError(bootError));
  } else {
    showMissingBook();
  }
}

async function loadBook(bookFileName = initialBookName) {
  const bookName = getSafeBookName(bookFileName);
  const title = fileNameToTitle(bookName);
  const pdfUrl = `./books/${encodeURIComponent(bookName)}`;
  const requestId = ++loadRequestId;

  currentHintKey = "errorHint";
  elements.errorHint.innerHTML = t("errorHint");
  destroyFlipbook();
  updatePageTitle(bookName, title);
  elements.book.hidden = true;

  try {
    setLoading(2, t("openingPdf"));

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapPacked: true,
    });

    loadingTask.onProgress = ({ loaded, total }) => {
      if (!total) return;
      const downloadProgress = Math.min(30, Math.round((loaded / total) * 30));
      setLoading(downloadProgress, t("downloadingPdf"));
    };

    const pdf = await loadingTask.promise;
    if (requestId !== loadRequestId) return;
    if (!pdf.numPages) {
      throw new Error(language === "es" ? "El PDF no contiene páginas." : "The PDF has no pages.");
    }

    elements.statusText.textContent = t("pages", pdf.numPages);

    const firstPage = await pdf.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: 1 });
    const pageRatio = firstViewport.height / firstViewport.width;

    const renderWidth = chooseRenderWidth();
    const imageUrls = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = renderWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      context.save();
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();

      await page.render({
        canvasContext: context,
        viewport,
        background: "#ffffff",
      }).promise;

      const blob = await canvasToBlob(canvas);
      if (requestId !== loadRequestId) return;
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.push(objectUrl);
      imageUrls.push(objectUrl);

      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();

      const renderProgress = 30 + Math.round((pageNumber / pdf.numPages) * 68);
      setLoading(
        renderProgress,
        t("preparingPages", pageNumber, pdf.numPages)
      );

      await letBrowserBreathe();
    }

    if (requestId !== loadRequestId) return;

    totalRealPages = pdf.numPages;
    currentRealPage = 1;

    const blankPage = await createBlankPage(pageRatio);
    imageUrls.unshift(blankPage);
    imageUrls.push(blankPage);
    objectUrls.push(blankPage);

    setLoading(99, t("assemblingBook"));
    buildFlipbook(imageUrls, pageRatio);
    elements.book.hidden = false;
    setLoading(100, t("ready"));

    elements.loading.hidden = true;
    disableNavigation(false);
    lastViewerSize = "";
    requestBookReflow(true);
    updateCounter(pageFlip.getCurrentPageIndex());
  } catch (error) {
    if (requestId !== loadRequestId) return;
    console.error(error);
    showError(normalizeError(error));
  }
}

function destroyFlipbook() {
  if (pageFlip) {
    pageFlip.destroy();
    pageFlip = null;
  }

  elements.book.innerHTML = "";
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}

function buildFlipbook(imageUrls, pageRatio) {
  const baseWidth = 1000;
  const baseHeight = Math.max(1, Math.round(baseWidth * pageRatio));

  pageFlip = new St.PageFlip(elements.book, {
    width: baseWidth,
    height: baseHeight,
    size: "stretch",
    minWidth: 80,
    maxWidth: 4000,
    minHeight: Math.max(80, Math.round(80 * pageRatio)),
    maxHeight: 4000,
    autoSize: true,
    drawShadow: true,
    maxShadowOpacity: 0.18,
    showCover: false,
    usePortrait: false,
    mobileScrollSupport: true,
    useMouseEvents: true,
    swipeDistance: 30,
    flippingTime: 650,
    disableFlipByClick: true,
    clickEventForward: false,
  });

  pageFlip.on("flip", () => {
    updateCounter(pageFlip.getCurrentPageIndex());
  });

  window.pageFlip = pageFlip;

  pageFlip.on("changeOrientation", () => {
    updateCounter(pageFlip.getCurrentPageIndex());
  });

  pageFlip.loadFromImages(imageUrls);
  patchCanvasBackground();
}

function patchCanvasBackground() {
  const canvas = elements.book.querySelector("canvas");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  if (context.__fitBackground) return;
  context.__fitBackground = true;

  const fillRect = context.fillRect.bind(context);
  context.fillRect = function (x, y, width, height) {
    const fullClear =
      x === 0 &&
      y === 0 &&
      width === canvas.width &&
      height === canvas.height &&
      isWhiteFill(this.fillStyle);

    if (fullClear) {
      const previous = this.fillStyle;
      this.fillStyle = getViewerBackground();
      fillRect(x, y, width, height);
      this.fillStyle = previous;
      return;
    }

    fillRect(x, y, width, height);
  };
}

function isWhiteFill(value) {
  const color = String(value).replace(/\s+/g, "").toLowerCase();
  return color === "white" || color === "#fff" || color === "#ffffff" || color === "rgb(255,255,255)";
}

function getViewerBackground() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--bg-viewer").trim() ||
    "#0e0e0d"
  );
}

function isLandscape() {
  return pageFlip?.getOrientation() === "landscape";
}

function getSpreadStart(physicalIndex) {
  if (!isLandscape()) return physicalIndex;
  return physicalIndex - (physicalIndex % 2);
}

function physicalToRealPage(physicalIndex) {
  if (!pageFlip || !totalRealPages) return 1;

  const lastPhysical = pageFlip.getPageCount() - 1;
  if (physicalIndex <= 0) return 1;
  if (physicalIndex >= lastPhysical) return totalRealPages;
  return Math.max(1, Math.min(totalRealPages, physicalIndex));
}

function realToPhysicalPage(realPage) {
  if (!pageFlip || !totalRealPages) return 1;
  return Math.min(pageFlip.getPageCount() - 1, Math.max(1, realPage));
}

function getVisibleRealPages(physicalIndex) {
  if (!pageFlip || !totalRealPages) return [1];

  const lastPhysical = pageFlip.getPageCount() - 1;
  const start = getSpreadStart(Math.max(0, Math.min(lastPhysical, physicalIndex)));
  const pages = [];

  for (const physical of isLandscape() ? [start, start + 1] : [start]) {
    if (physical <= 0 || physical >= lastPhysical) continue;
    pages.push(Math.max(1, Math.min(totalRealPages, physical)));
  }

  return pages.length ? pages : [physicalToRealPage(physicalIndex)];
}

function isOnFirstSpread(physicalIndex = pageFlip.getCurrentPageIndex()) {
  return getSpreadStart(physicalIndex) === 0;
}

function isOnLastSpread(physicalIndex = pageFlip.getCurrentPageIndex()) {
  return getSpreadStart(physicalIndex) >= getSpreadStart(pageFlip.getPageCount() - 1);
}

function updateCounter(pageIndex) {
  if (!pageFlip || !totalRealPages) return;

  const physicalPageCount = pageFlip.getPageCount();
  const physicalIndex = Math.max(0, Math.min(physicalPageCount - 1, pageIndex));
  const visible = getVisibleRealPages(physicalIndex);
  currentRealPage = visible[0];

  const label = visible.length === 2 ? `${visible[0]}–${visible[1]}` : `${visible[0]}`;
  elements.pageCounter.textContent = `${label} / ${totalRealPages}`;

  const onFirst = isOnFirstSpread(physicalIndex);
  const onLast = isOnLastSpread(physicalIndex);
  elements.prevButton.disabled = onFirst;
  elements.firstButton.disabled = onFirst;
  elements.nextButton.disabled = onLast;
  elements.lastButton.disabled = onLast;
}

async function createBlankPage(pageRatio) {
  const canvas = document.createElement("canvas");
  const width = 1200;
  const height = Math.round(width * pageRatio);
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  const viewerColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--bg-viewer")
    .trim();
  context.fillStyle = viewerColor || "#0e0e0d";
  context.fillRect(0, 0, width, height);

  const blob = await canvasToBlob(canvas);
  return URL.createObjectURL(blob);
}

function withProgrammaticFlip(action) {
  const settings = pageFlip.getSettings();
  const previous = settings.disableFlipByClick;
  settings.disableFlipByClick = false;
  try {
    action();
  } finally {
    settings.disableFlipByClick = previous;
  }
}

function flipToPhysical(targetPhysical) {
  const current = pageFlip.getCurrentPageIndex();
  if (getSpreadStart(current) === getSpreadStart(targetPhysical)) {
    updateCounter(current);
    return;
  }

  withProgrammaticFlip(() => {
    pageFlip.flip(targetPhysical, "bottom");
  });
}

function goToPage(pageNumber) {
  if (!pageFlip || !totalRealPages) return;

  const targetReal = Math.min(totalRealPages, Math.max(1, pageNumber));
  flipToPhysical(realToPhysicalPage(targetReal));
}

function navigateByOffset(offset) {
  if (!pageFlip || !totalRealPages) return;

  const current = pageFlip.getCurrentPageIndex();

  if (offset > 0) {
    if (isOnLastSpread(current)) {
      updateCounter(current);
      return;
    }
    withProgrammaticFlip(() => {
      pageFlip.flipNext("bottom");
    });
    return;
  }

  if (isOnFirstSpread(current)) {
    updateCounter(current);
    return;
  }

  withProgrammaticFlip(() => {
    pageFlip.flipPrev("bottom");
  });
}

function disableNavigation(disabled) {
  elements.firstButton.disabled = disabled;
  elements.prevButton.disabled = disabled;
  elements.nextButton.disabled = disabled;
  elements.lastButton.disabled = disabled;
  elements.fullscreenButton.disabled = disabled;
}

elements.firstButton.addEventListener("click", () => {
  goToPage(1);
});

elements.prevButton.addEventListener("click", () => {
  navigateByOffset(-1);
});

elements.nextButton.addEventListener("click", () => {
  navigateByOffset(1);
});

elements.lastButton.addEventListener("click", () => {
  if (!pageFlip || !totalRealPages) return;
  goToPage(totalRealPages);
});

function getNativeFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function isFullscreenActive() {
  return Boolean(getNativeFullscreenElement()) || cssFullscreen;
}

function getFullscreenRequest(element) {
  return (
    element.requestFullscreen ||
    element.webkitRequestFullscreen ||
    element.webkitRequestFullScreen ||
    element.mozRequestFullScreen ||
    element.msRequestFullscreen ||
    null
  );
}

function getFullscreenExit() {
  return (
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.webkitCancelFullScreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen ||
    null
  );
}

function toPromise(result) {
  return result && typeof result.then === "function" ? result : Promise.resolve(result);
}

function syncFullscreenUi() {
  document.documentElement.classList.toggle("is-app-fullscreen", isFullscreenActive());
  elements.fullscreenButton.textContent = isFullscreenActive()
    ? t("exitFullscreen")
    : t("fullscreen");
  requestBookReflow();
}

async function enterFullscreen() {
  const targets = [document.documentElement, document.body, elements.viewer];

  for (const target of targets) {
    const request = getFullscreenRequest(target);
    if (!request) continue;

    try {
      await toPromise(request.call(target));
      cssFullscreen = false;
      syncFullscreenUi();
      return;
    } catch (error) {
      // iOS and some mobile browsers reject the native API.
    }
  }

  cssFullscreen = true;
  syncFullscreenUi();
}

async function exitFullscreen() {
  cssFullscreen = false;
  const exit = getFullscreenExit();
  if (exit && getNativeFullscreenElement()) {
    try {
      await toPromise(exit.call(document));
    } catch (error) {
      // Keep the CSS fallback in sync even if the native exit fails.
    }
  }
  syncFullscreenUi();
}

elements.fullscreenButton.addEventListener("click", async () => {
  if (isFullscreenActive()) {
    await exitFullscreen();
    return;
  }

  await enterFullscreen();
});

["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach(
  (eventName) => {
    document.addEventListener(eventName, () => {
      if (getNativeFullscreenElement()) {
        cssFullscreen = false;
      }
      syncFullscreenUi();
    });
  }
);

let bookReflowTimer = 0;
let lastViewerSize = "";

function getViewerSizeKey() {
  return `${elements.viewer.clientWidth}x${elements.viewer.clientHeight}`;
}

function requestBookReflow(force = false) {
  if (!pageFlip || elements.book.hidden) return;
  if (pageFlip.getState?.() === "flipping") return;

  const sizeKey = getViewerSizeKey();
  if (!force && sizeKey === lastViewerSize) return;
  lastViewerSize = sizeKey;

  window.clearTimeout(bookReflowTimer);
  bookReflowTimer = window.setTimeout(() => {
    if (pageFlip?.getState?.() === "flipping") return;
    window.dispatchEvent(new Event("resize"));
  }, 80);
}

const viewerResizeObserver = new ResizeObserver(() => {
  requestBookReflow();
});

viewerResizeObserver.observe(elements.viewer);

window.visualViewport?.addEventListener("resize", () => {
  requestBookReflow();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cssFullscreen) {
    event.preventDefault();
    exitFullscreen();
    return;
  }

  if (!pageFlip) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    navigateByOffset(-1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    navigateByOffset(1);
  }

  if (event.key === "Home") {
    event.preventDefault();
    goToPage(1);
  }

  if (event.key === "End") {
    event.preventDefault();
    goToPage(totalRealPages);
  }
});

window.addEventListener("beforeunload", () => {
  pageFlip?.destroy();
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
});

function chooseRenderWidth() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewportWidth = window.innerWidth;

  if (viewportWidth <= 680) {
    return Math.round(Math.min(1400, Math.max(900, viewportWidth * dpr * 1.35)));
  }

  return Math.round(Math.min(1600, Math.max(1200, (viewportWidth / 2) * dpr * 1.25)));
}

function setLoading(percent, label) {
  const normalized = Math.max(0, Math.min(100, Math.round(percent)));
  elements.progressBar.style.width = `${normalized}%`;
  elements.loadingPercent.textContent = `${normalized}%`;
  elements.loadingLabel.textContent = label;
}

function showMissingBook() {
  currentHintKey = "missingBookHint";
  elements.errorTitle.textContent = t("missingBookTitle");
  elements.errorHint.textContent = t("missingBookHint");
  showError(t("missingBook"));
  elements.statusText.textContent = "";
}

function showError(message) {
  disableNavigation(true);
  elements.loading.hidden = true;
  elements.book.hidden = true;
  elements.errorMessage.textContent = message;
  elements.errorPanel.hidden = false;
  elements.statusText.textContent = t("error");
}

function normalizeError(error) {
  const text = error?.message || String(error);

  if (
    text.includes("Missing PDF") ||
    text.includes("Unexpected server response") ||
    text.includes("404")
  ) {
    return t("missingFile", initialBookName);
  }

  if (text.includes("Invalid PDF")) {
    return t("invalidPdf");
  }

  return text;
}

function getSafeBookName(value) {
  const name = (value || "").trim();

  if (
    !name ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..") ||
    !name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error(
      t("invalidBookName")
    );
  }

  return name;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fileNameToTitle(fileName) {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Falha ao converter uma página do PDF em imagem."));
        }
      },
      "image/jpeg",
      0.92
    );
  });
}

function letBrowserBreathe() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}
