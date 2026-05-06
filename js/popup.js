/* ==========================================================================
   Popup de Acessibilidade
   - Abre automaticamente em toda visita à página (não usa sessionStorage)
   - Focus trap interno, ESC para fechar, retorno de foco ao botão de origem
   ========================================================================== */

(function () {
    "use strict";

    const modal = document.getElementById("a11y-modal");
    if (!modal) return;

    const focusableSelector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])'
    ].join(",");

    let lastTrigger = null;
    let isOpen = false;

    function openModal(trigger) {
        if (isOpen) return;
        isOpen = true;
        lastTrigger = trigger || null;
        modal.hidden = false;
        document.body.style.overflow = "hidden";

        const focusables = modal.querySelectorAll(focusableSelector);
        if (focusables.length) {
            setTimeout(() => focusables[0].focus(), 50);
        }

        if (window.AudioFX) window.AudioFX.open();
    }

    function closeModal() {
        if (!isOpen) return;
        isOpen = false;
        modal.hidden = true;
        document.body.style.overflow = "";

        if (lastTrigger && typeof lastTrigger.focus === "function") {
            lastTrigger.focus();
        }
        if (window.AudioFX) window.AudioFX.close();
    }

    function trapFocus(e) {
        if (!isOpen || e.key !== "Tab") return;
        const focusables = Array.from(modal.querySelectorAll(focusableSelector))
            .filter((el) => !el.disabled && el.offsetParent !== null);
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function bindOpeners() {
        const ids = ["open-accessibility", "open-accessibility-2", "open-accessibility-3"];
        ids.forEach((id) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    openModal(btn);
                });
            }
        });
    }

    function bindClosers() {
        modal.querySelectorAll("[data-close]").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                closeModal();
            });
        });
    }

    function bindKeyboard() {
        document.addEventListener("keydown", (e) => {
            if (!isOpen) return;
            if (e.key === "Escape") {
                e.preventDefault();
                closeModal();
            }
            trapFocus(e);
        });
    }

    function autoOpen() {
        // Aparece sempre que o usuário entra no blog (a cada navegação).
        setTimeout(() => openModal(null), 380);
    }

    bindOpeners();
    bindClosers();
    bindKeyboard();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoOpen);
    } else {
        autoOpen();
    }
})();
