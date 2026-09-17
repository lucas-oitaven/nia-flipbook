import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs";

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
  errorMessage: document.querySelector("#error-message"),
  firstButton: document.querySelector("#first-button"),
  prevButton: document.querySelector("#prev-button"),
  nextButton: document.querySelector("#next-button"),
  lastButton: document.querySelector("#last-button"),
  fullscreenButton: document.querySelector("#fullscreen-button"),
  pageCounter: document.querySelector("#page-counter"),
  bookSelect: document.querySelector("#book-select"),
};

let pageFlip = null;
let objectUrls = [];
let loadRequestId = 0;
let availableBooks = [];
let totalRealPages = 0;
let currentRealPage = 1;

const params = new URLSearchParams(window.location.search);
const initialBookName = getSafeBookName(params.get("book") || "sample.pdf");
const initialTitle = params.get("title")?.trim() || fileNameToTitle(initialBookName);

function updatePageTitle(bookName, customTitle) {
  const title = customTitle?.trim() || fileNameToTitle(bookName);
  elements.bookTitle.textContent = title;
  document.title = `${title} — Flipbook`;
}

updatePageTitle(initialBookName, initialTitle);
disableNavigation(true);
loadAvailableBooks();

async function loadAvailableBooks() {
  try {
    const response = await fetch("./books/books.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Lista de livros indisponível");
    }

    const data = await response.json();
    availableBooks = Array.isArray(data.books) ? data.books : [];
  } catch (error) {
    console.warn("Não foi possível carregar a lista de livros automaticamente:", error);
    availableBooks = [{ file: initialBookName, title: fileNameToTitle(initialBookName) }];
  }

  const options = availableBooks.map((book) => ({
    value: book.file,
    label: book.title || fileNameToTitle(book.file),
  }));

  const currentValue = initialBookName;
  const values = new Set(options.map((item) => item.value));

  if (!values.has(currentValue) && initialBookName) {
    options.unshift({ value: initialBookName, label: fileNameToTitle(initialBookName) });
  }

  elements.bookSelect.innerHTML = options
    .map(
      (item) =>
        `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`
    )
    .join("");

  elements.bookSelect.value = currentValue;
  elements.bookSelect.disabled = options.length <= 1;

  elements.bookSelect.onchange = (event) => {
    const nextBook = event.target.value;
    if (!nextBook) return;

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("book", nextBook);
    nextUrl.searchParams.set("title", fileNameToTitle(nextBook));
    window.location.href = nextUrl.toString();
  };

  loadBook(currentValue);
}

async function loadBook(bookFileName = initialBookName) {
  const bookName = getSafeBookName(bookFileName);
  const title = fileNameToTitle(bookName);
  const pdfUrl = `./books/${encodeURIComponent(bookName)}`;
  const requestId = ++loadRequestId;

  destroyFlipbook();
  updatePageTitle(bookName, title);
  elements.book.hidden = true;

  try {
    setLoading(2, "Abrindo PDF…");

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapPacked: true,
    });

    loadingTask.onProgress = ({ loaded, total }) => {
      if (!total) return;
      const downloadProgress = Math.min(30, Math.round((loaded / total) * 30));
      setLoading(downloadProgress, "Baixando PDF…");
    };

    const pdf = await loadingTask.promise;
    if (requestId !== loadRequestId) return;
    if (!pdf.numPages) {
      throw new Error("O PDF não contém páginas.");
    }

    elements.statusText.textContent = `${pdf.numPages} página${pdf.numPages === 1 ? "" : "s"}`;

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
        `Preparando páginas… ${pageNumber}/${pdf.numPages}`
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

    setLoading(99, "Montando livro…");
    buildFlipbook(imageUrls, pageRatio);
    elements.book.hidden = false;
    setLoading(100, "Pronto");

    elements.loading.hidden = true;
    disableNavigation(false);
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
  const baseWidth = 700;
  const baseHeight = Math.max(700, Math.round(baseWidth * pageRatio));

  pageFlip = new St.PageFlip(elements.book, {
    width: baseWidth,
    height: baseHeight,
    size: "stretch",
    minWidth: 240,
    maxWidth: 1100,
    minHeight: Math.round(240 * pageRatio),
    maxHeight: Math.round(1100 * pageRatio),
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

  const physicalPageCount = pageFlip.getPageCount();

  if (physicalIndex <= 0) return 1;
  if (physicalIndex >= physicalPageCount - 1) return totalRealPages;
  return Math.max(1, Math.min(totalRealPages, physicalIndex));
}

function realToPhysicalPage(realPage) {
  if (!pageFlip || !totalRealPages) return 1;
  return Math.min(pageFlip.getPageCount() - 1, Math.max(1, realPage));
}

function getVisibleRealPages(physicalIndex) {
  if (!pageFlip || !totalRealPages) return [1];

  const physicalCount = pageFlip.getPageCount();
  const start = getSpreadStart(Math.max(0, Math.min(physicalCount - 1, physicalIndex)));
  const pages = [];

  for (const physical of isLandscape() ? [start, start + 1] : [start]) {
    if (physical <= 0 || physical >= physicalCount - 1) continue;
    pages.push(Math.max(1, Math.min(totalRealPages, physical)));
  }

  return pages.length ? pages : [physicalToRealPage(physicalIndex)];
}

function isOnFirstSpread(physicalIndex = pageFlip.getCurrentPageIndex()) {
  return getVisibleRealPages(physicalIndex).includes(1);
}

function isOnLastSpread(physicalIndex = pageFlip.getCurrentPageIndex()) {
  return getVisibleRealPages(physicalIndex).includes(totalRealPages);
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
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const blob = await canvasToBlob(canvas);
  return URL.createObjectURL(blob);
}

function flipToPhysical(targetPhysical) {
  const current = pageFlip.getCurrentPageIndex();
  if (getSpreadStart(current) === getSpreadStart(targetPhysical)) {
    updateCounter(current);
    return;
  }

  pageFlip.flip(targetPhysical, "bottom");
}

function goToPage(pageNumber) {
  if (!pageFlip || !totalRealPages) return;

  const targetReal = Math.min(totalRealPages, Math.max(1, pageNumber));
  flipToPhysical(realToPhysicalPage(targetReal));
}

function navigateByOffset(offset) {
  if (!pageFlip || !totalRealPages) return;

  if (offset > 0) {
    if (isOnLastSpread()) {
      updateCounter(pageFlip.getCurrentPageIndex());
      return;
    }
    pageFlip.flipNext("bottom");
    return;
  }

  if (isOnFirstSpread()) {
    updateCounter(pageFlip.getCurrentPageIndex());
    return;
  }

  pageFlip.flipPrev("bottom");
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

elements.fullscreenButton.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await elements.viewer.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.warn("Tela cheia não disponível:", error);
  }
});

document.addEventListener("fullscreenchange", () => {
  elements.fullscreenButton.textContent = document.fullscreenElement
    ? "Sair da tela cheia"
    : "Tela cheia";
});

document.addEventListener("keydown", (event) => {
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

function showError(message) {
  disableNavigation(true);
  elements.loading.hidden = true;
  elements.book.hidden = true;
  elements.errorMessage.textContent = message;
  elements.errorPanel.hidden = false;
  elements.statusText.textContent = "Erro";
}

function normalizeError(error) {
  const text = error?.message || String(error);

  if (
    text.includes("Missing PDF") ||
    text.includes("Unexpected server response") ||
    text.includes("404")
  ) {
    return `O arquivo "${bookName}" não foi encontrado.`;
  }

  if (text.includes("Invalid PDF")) {
    return "O arquivo encontrado não parece ser um PDF válido.";
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
      'Nome de livro inválido. Use apenas o nome do PDF, por exemplo "?book=meu-livro.pdf".'
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
