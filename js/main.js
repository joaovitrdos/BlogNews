/* ==========================================================================
   Main: filtros de categorias, paginação visual, navegação por teclado.
   ========================================================================== */

(function () {
    "use strict";

    function initFilters() {
        const filterButtons = document.querySelectorAll(".filter[data-filter]");
        const posts = document.querySelectorAll(".post-row[data-cat]");

        if (!filterButtons.length || !posts.length) return;

        filterButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const category = btn.getAttribute("data-filter");

                filterButtons.forEach((b) => {
                    b.classList.remove("active");
                    b.setAttribute("aria-selected", "false");
                });
                btn.classList.add("active");
                btn.setAttribute("aria-selected", "true");

                let visibleCount = 0;
                posts.forEach((post) => {
                    const matches = category === "all" || post.getAttribute("data-cat") === category;
                    post.style.display = matches ? "" : "none";
                    if (matches) visibleCount++;
                });

                announce(`${visibleCount} ${visibleCount === 1 ? "notícia encontrada" : "notícias encontradas"}.`);
                if (window.AudioFX) window.AudioFX.click();
            });
        });
    }

    function announce(message) {
        let live = document.getElementById("a11y-live-region");
        if (!live) {
            live = document.createElement("div");
            live.id = "a11y-live-region";
            live.className = "sr-only";
            live.setAttribute("role", "status");
            live.setAttribute("aria-live", "polite");
            document.body.appendChild(live);
        }
        live.textContent = "";
        setTimeout(() => { live.textContent = message; }, 50);
    }

    function initPagination() {
        const buttons = document.querySelectorAll(".page-btn:not(:disabled)");
        buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
                if (btn.classList.contains("active")) return;
                const numeric = btn.textContent.trim();
                if (/^\d+$/.test(numeric)) {
                    document.querySelectorAll(".page-btn").forEach((b) => {
                        b.classList.remove("active");
                        b.removeAttribute("aria-current");
                    });
                    btn.classList.add("active");
                    btn.setAttribute("aria-current", "page");
                    const list = document.getElementById("news-list");
                    if (list) list.scrollIntoView({ behavior: "smooth", block: "start" });
                    if (window.AudioFX) window.AudioFX.click();
                }
            });
        });
    }

    function initSmoothLinks() {
        document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach((link) => {
            link.addEventListener("click", (e) => {
                const id = link.getAttribute("href");
                if (id.length > 1) {
                    const target = document.querySelector(id);
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({ behavior: "smooth", block: "start" });
                        target.setAttribute("tabindex", "-1");
                        target.focus({ preventScroll: true });
                    }
                }
            });
        });
    }

    function initKeyboardShortcut() {
        // Atalho: Alt+A abre o painel de acessibilidade
        document.addEventListener("keydown", (e) => {
            if (e.altKey && (e.key === "a" || e.key === "A")) {
                e.preventDefault();
                const opener = document.getElementById("open-accessibility");
                if (opener) opener.click();
            }
        });
    }

    function init() {
        initFilters();
        initPagination();
        initSmoothLinks();
        initKeyboardShortcut();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
