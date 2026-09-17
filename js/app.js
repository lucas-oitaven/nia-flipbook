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
  prevButton: document.querySelector("#prev-button"),
  nextButton: document.querySelector("#next-button"),
  fullscreenButton: document.querySelector("#fullscreen-button"),
  pageCounter: document.querySelector("#page-counter"),
};

let pageFlip = null;
let objectUrls = [];

const params = new URLSearchParams(window.location.search);
const bookName = getSafeBookName(params.get("book") || "sample.pdf");
const title = params.get("title")?.trim() || fileNameToTitle(bookName);
const pdfUrl = `./books/${encodeURIComponent(bookName)}`;

elements.bookTitle.textContent = title;
document.title = `${title} — Flipbook`;

disableNavigation(true);
loadBook();

async function loadBook() {
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

    setLoading(99, "Montando livro…");
    elements.book.hidden = false;
    buildFlipbook(imageUrls, pageRatio);
    setLoading(100, "Pronto");

    elements.loading.hidden = true;
    disableNavigation(false);
    updateCounter(0);
  } catch (error) {
    console.error(error);
    showError(normalizeError(error));
  }
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
    maxShadowOpacity: 0.32,
    showCover: true,
    usePortrait: true,
    mobileScrollSupport: true,
    useMouseEvents: true,
    swipeDistance: 30,
    flippingTime: 650,
    disableFlipByClick: false,
  });

  pageFlip.on("flip", (event) => {
    updateCounter(Number(event.data));
  });

  pageFlip.on("changeOrientation", () => {
    updateCounter(pageFlip.getCurrentPageIndex());
  });

  pageFlip.loadFromImages(imageUrls);
}

function updateCounter(pageIndex) {
  if (!pageFlip) return;

  const total = pageFlip.getPageCount();
  const current = Math.min(total, Math.max(1, pageIndex + 1));

  elements.pageCounter.textContent = `${current} / ${total}`;
  elements.prevButton.disabled = pageIndex <= 0;
  elements.nextButton.disabled = pageIndex >= total - 1;
}

function disableNavigation(disabled) {
  elements.prevButton.disabled = disabled;
  elements.nextButton.disabled = disabled;
  elements.fullscreenButton.disabled = disabled;
}

elements.prevButton.addEventListener("click", () => {
  pageFlip?.flipPrev("top");
});

elements.nextButton.addEventListener("click", () => {
  pageFlip?.flipNext("top");
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
    pageFlip.flipPrev("top");
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    pageFlip.flipNext("top");
  }

  if (event.key === "Home") {
    event.preventDefault();
    pageFlip.turnToPage(0);
    updateCounter(0);
  }

  if (event.key === "End") {
    event.preventDefault();
    const lastPage = pageFlip.getPageCount() - 1;
    pageFlip.turnToPage(lastPage);
    updateCounter(lastPage);
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
  const name = value.trim();

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
