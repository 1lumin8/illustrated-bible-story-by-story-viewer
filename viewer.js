const { pageCount: PAGE_COUNT, sections, tocGroups } = window.BOOK_DATA;
const HIDDEN_BOOK_PAGES = new Set(window.BOOK_DATA.hiddenPages);
const grid = document.querySelector("#pageGrid");
const tocPanel = document.querySelector("#tocPanel");
const tableOfContents = document.querySelector("#tableOfContents");
const pageSize = document.querySelector("#pageSize");
const searchInput = document.querySelector("#searchInput");
const searchStatus = document.querySelector("#searchStatus");
const searchResults = document.querySelector("#searchResults");
const scrollTopButton = document.querySelector("#scrollTop");
const viewer = document.querySelector("#viewer");
const pane = document.querySelector("#viewerPane");
const viewerImage = document.querySelector("#viewerImage");
const zoomLabel = document.querySelector("#zoomLabel");
const prevButton = document.querySelector("#prevPage");
const nextButton = document.querySelector("#nextPage");

let activePage = 0;
let fitWidth = 700;
let zoom = 1;
let dragging = false;
let dragStart = null;
let searchTimer = null;

const pagePath = (page) => `assets/pages/page-${String(page).padStart(3, "0")}.jpg`;
const pageText = (page) => window.SEARCH_INDEX?.[page - 1]?.text || "";
const pageLabel = (page) => page === 1 ? "Cover" : `Page ${page}`;
const isVisiblePage = (page) => page >= 1 && page <= PAGE_COUNT && !HIDDEN_BOOK_PAGES.has(page);

function adjacentPage(page, direction) {
  let candidate = page + direction;
  while (candidate >= 1 && candidate <= PAGE_COUNT && !isVisiblePage(candidate)) candidate += direction;
  return candidate >= 1 && candidate <= PAGE_COUNT ? candidate : null;
}

function buildViewer() {
  const gridFragment = document.createDocumentFragment();

  sections.forEach((section) => {
    const heading = document.createElement("div");
    heading.className = "section-heading";
    heading.id = section.id;
    heading.dataset.section = section.id;
    heading.innerHTML = `<h2>${section.label}</h2><span>${section.range}</span>`;
    gridFragment.append(heading);

    for (let page = section.start; page <= section.end; page += 1) {
      const bookPage = page;
      if (bookPage && HIDDEN_BOOK_PAGES.has(bookPage)) continue;
      const card = document.createElement("figure");
      const button = document.createElement("button");
      const image = document.createElement("img");
      const caption = document.createElement("figcaption");
      card.className = "page-card";
      card.dataset.page = page;
      card.dataset.section = section.id;
      card.id = bookPage ? `book-page-${bookPage}` : `pdf-page-${page}`;
      card.classList.add("toc-target");
      button.className = "page-button";
      button.type = "button";
      button.dataset.page = page;
      button.setAttribute("aria-label", `Open ${pageLabel(page)}`);
      image.src = pagePath(page);
      image.alt = `The Illustrated Bible Story by Story, page ${page}`;
      image.loading = page <= 8 ? "eager" : "lazy";
      image.decoding = "async";
      caption.textContent = pageLabel(page);
      button.append(image);
      card.append(button, caption);
      gridFragment.append(card);
    }
  });

  grid.append(gridFragment);
}

function buildTableOfContents() {
  const fragment = document.createDocumentFragment();
  const shortcuts = document.createElement("nav");
  shortcuts.className = "toc-shortcuts";
  sections.forEach((section) => {
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.textContent = section.label;
    shortcuts.append(link);
  });
  fragment.append(shortcuts);

  tocGroups.forEach((group) => {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const links = document.createElement("div");
    details.className = `toc-group${group.wide ? " toc-group-wide" : ""}`;
    summary.textContent = group.label;
    links.className = "toc-links";
    group.items.forEach(([title, page]) => {
      const link = document.createElement("a");
      const pageNumber = document.createElement("small");
      link.href = `#book-page-${page}`;
      link.append(document.createTextNode(title));
      pageNumber.textContent = page;
      link.append(pageNumber);
      link.addEventListener("click", () => {
        tocPanel.open = false;
      });
      links.append(link);
    });
    details.append(summary, links);
    fragment.append(details);
  });
  tableOfContents.append(fragment);
}

function setPageSize() {
  document.documentElement.style.setProperty("--page-width", `${pageSize.value}px`);
}

function getFitWidth() {
  const ratio = 518.757 / 660.495;
  return Math.max(260, Math.min(pane.clientWidth - 28, (pane.clientHeight - 30) * ratio, 920));
}

function centerImage() {
  requestAnimationFrame(() => {
    pane.scrollLeft = Math.max(0, (viewerImage.offsetWidth - pane.clientWidth) / 2);
    pane.scrollTop = 0;
  });
}

function setZoom(nextZoom) {
  const oldWidth = viewerImage.offsetWidth || fitWidth;
  const centerX = pane.scrollLeft + pane.clientWidth / 2;
  const centerY = pane.scrollTop + pane.clientHeight / 2;
  const ratioX = centerX / oldWidth;
  const ratioY = centerY / (viewerImage.offsetHeight || oldWidth * 782.4 / 649.2);
  zoom = Math.max(.65, Math.min(4, nextZoom));
  viewerImage.style.width = `${Math.round(fitWidth * zoom)}px`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  requestAnimationFrame(() => {
    pane.scrollLeft = ratioX * viewerImage.offsetWidth - pane.clientWidth / 2;
    pane.scrollTop = ratioY * viewerImage.offsetHeight - pane.clientHeight / 2;
  });
}

function openPage(page) {
  activePage = Number(page);
  viewerImage.src = pagePath(activePage);
  viewerImage.alt = `The Illustrated Bible Story by Story, page ${activePage}`;
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");
  document.body.classList.add("viewing");
  fitWidth = getFitWidth();
  zoom = 1;
  viewerImage.style.width = `${Math.round(fitWidth)}px`;
  zoomLabel.textContent = "Fit";
  prevButton.disabled = !adjacentPage(activePage, -1);
  nextButton.disabled = !adjacentPage(activePage, 1);
  if (viewerImage.complete) centerImage();
  else viewerImage.addEventListener("load", centerImage, { once: true });
}

function closeViewer() {
  viewer.classList.remove("is-open");
  viewer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("viewing");
  activePage = 0;
}

function navigatePage(direction) {
  const target = adjacentPage(activePage, direction);
  if (target) openPage(target);
}

function highlight(text, query) {
  const safe = text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${escaped})`, "ig"), "<mark>$1</mark>");
}

function runSearch() {
  const query = searchInput.value.trim().toLowerCase();
  const cards = [...document.querySelectorAll(".page-card")];
  const headings = [...document.querySelectorAll(".section-heading")];
  searchResults.innerHTML = "";

  if (!query) {
    cards.forEach((card) => card.classList.remove("is-hidden"));
    headings.forEach((heading) => heading.classList.remove("is-hidden"));
    searchResults.classList.remove("is-visible");
    searchStatus.textContent = "Search stories and page text";
    return;
  }

  const terms = query.split(/\s+/).filter(Boolean);
  const matches = [];
  cards.forEach((card) => {
    const page = Number(card.dataset.page);
    const bookPage = page;
    const text = `${page} page ${page} ${pageText(page)}`.toLowerCase();
    const matchesAll = terms.every((term) => text.includes(term));
    card.classList.toggle("is-hidden", !matchesAll);
    if (matchesAll) matches.push({ card, page, text: pageText(page) });
  });

  headings.forEach((heading) => {
    const visible = cards.some((card) => card.dataset.section === heading.dataset.section && !card.classList.contains("is-hidden"));
    heading.classList.toggle("is-hidden", !visible);
  });

  searchStatus.textContent = matches.length ? `${matches.length} matching page${matches.length === 1 ? "" : "s"}` : "No matches";
  matches.slice(0, 10).forEach(({ card, page, text }) => {
    const result = document.createElement("button");
    const index = text.toLowerCase().indexOf(terms[0]);
    const start = Math.max(0, index - 70);
    const snippet = text.slice(start, start + 190);
    result.className = "result";
    result.innerHTML = `<strong>${pageLabel(page)}</strong><span>${highlight(`${start ? "…" : ""}${snippet}`, query)}</span>`;
    result.addEventListener("click", () => {
      searchResults.classList.remove("is-visible");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => openPage(page), 450);
    });
    searchResults.append(result);
  });
  searchResults.classList.toggle("is-visible", matches.length > 0);
}

grid.addEventListener("click", (event) => {
  const button = event.target.closest(".page-button");
  if (button) openPage(button.dataset.page);
});
pageSize.addEventListener("input", setPageSize);
document.querySelector("#closeViewer").addEventListener("click", closeViewer);
document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + .25));
document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - .25));
document.querySelector("#fitPage").addEventListener("click", () => openPage(activePage));
prevButton.addEventListener("click", () => navigatePage(-1));
nextButton.addEventListener("click", () => navigatePage(1));

pane.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  dragging = true;
  dragStart = { x: event.clientX, y: event.clientY, left: pane.scrollLeft, top: pane.scrollTop };
  pane.classList.add("is-dragging");
  pane.setPointerCapture(event.pointerId);
});
pane.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  pane.scrollLeft = dragStart.left - (event.clientX - dragStart.x);
  pane.scrollTop = dragStart.top - (event.clientY - dragStart.y);
});
pane.addEventListener("pointerup", (event) => {
  dragging = false;
  pane.classList.remove("is-dragging");
  pane.releasePointerCapture(event.pointerId);
});
pane.addEventListener("wheel", (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  setZoom(zoom + (event.deltaY > 0 ? -.15 : .15));
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if (!activePage) return;
  if (event.key === "Escape") closeViewer();
  if (event.key === "ArrowLeft") navigatePage(-1);
  if (event.key === "ArrowRight") navigatePage(1);
  if (event.key === "+" || event.key === "=") setZoom(zoom + .25);
  if (event.key === "-") setZoom(zoom - .25);
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 140);
});
window.addEventListener("scroll", () => scrollTopButton.classList.toggle("is-visible", scrollY > 700), { passive: true });
scrollTopButton.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

buildViewer();
buildTableOfContents();
setPageSize();
