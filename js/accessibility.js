/* ==========================================================================
   Accessibility Manager
   Gerencia preferências do usuário e aplica nas páginas. Persistência via
   localStorage para que escolhas permaneçam entre páginas.
   ========================================================================== */

(function () {
    "use strict";

    const STORAGE_KEY = "blog-acessivel-prefs";

    const DEFAULTS = {
        font: 100,
        cb: "none",
        toggles: {
            "dark-mode": false,
            "high-contrast": false,
            "invert": false,
            "saturate": false,
            "readable-font": false,
            "line-spacing": false,
            "letter-spacing": false,
            "highlight-links": false,
            "reading-guide": false,
            "tts": false,
            "hover-tts": true,
            "reduce-motion": false,
            "big-cursor": false
        }
    };

    const TOGGLE_TARGETS = {
        "dark-mode": "body",
        "high-contrast": "body",
        "invert": "html",
        "saturate": "html",
        "readable-font": "body",
        "line-spacing": "body",
        "letter-spacing": "body",
        "highlight-links": "body",
        "reading-guide": "body",
        "tts": "body",
        "hover-tts": "body",
        "reduce-motion": "body",
        "big-cursor": "body"
    };

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function loadPrefs() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return deepClone(DEFAULTS);
            const parsed = JSON.parse(raw);
            return Object.assign(deepClone(DEFAULTS), parsed, {
                toggles: Object.assign({}, DEFAULTS.toggles, parsed.toggles || {})
            });
        } catch (e) {
            return deepClone(DEFAULTS);
        }
    }

    function savePrefs(prefs) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch (e) {
            // localStorage indisponível — segue sem persistir
        }
    }

    const A11y = {
        prefs: loadPrefs(),

        init() {
            this.applyAll();
            this.bindControls();
            this.syncControls();
            this.handleReadingGuide();
        },

        applyAll() {
            this.applyFont();
            this.applyColorblind();
            Object.keys(this.prefs.toggles).forEach((key) => this.applyToggle(key));
        },

        applyFont() {
            const html = document.documentElement;
            ["font-100", "font-115", "font-130", "font-150"].forEach((c) => html.classList.remove(c));
            html.classList.add("font-" + this.prefs.font);
        },

        applyColorblind() {
            const html = document.documentElement;
            ["cb-protanopia", "cb-deuteranopia", "cb-tritanopia", "cb-achromatopsia"].forEach((c) => html.classList.remove(c));
            if (this.prefs.cb && this.prefs.cb !== "none") {
                html.classList.add("cb-" + this.prefs.cb);
            }
        },

        applyToggle(key) {
            const value = !!this.prefs.toggles[key];
            const target = TOGGLE_TARGETS[key] === "html" ? document.documentElement : document.body;
            target.classList.toggle(key, value);

            if (key === "reading-guide") {
                this.toggleReadingGuide(value);
            }
            if (key === "tts" && window.TTSManager) {
                window.TTSManager.setEnabled(value);
            }
            if (key === "hover-tts" && window.TTSManager) {
                window.TTSManager.setHoverEnabled(value);
            }
        },

        setFont(value) {
            this.prefs.font = parseInt(value, 10) || 100;
            this.applyFont();
            savePrefs(this.prefs);
            this.syncControls();
            if (window.AudioFX) window.AudioFX.click();
        },

        setColorblind(value) {
            this.prefs.cb = value;
            this.applyColorblind();
            savePrefs(this.prefs);
            this.syncControls();
            if (window.AudioFX) window.AudioFX.click();
        },

        setToggle(key, value) {
            this.prefs.toggles[key] = !!value;
            this.applyToggle(key);
            savePrefs(this.prefs);
            if (window.AudioFX) value ? window.AudioFX.on() : window.AudioFX.off();
        },

        reset() {
            this.prefs = deepClone(DEFAULTS);
            this.applyAll();
            this.syncControls();
            savePrefs(this.prefs);
            if (window.AudioFX) window.AudioFX.click();
        },

        bindControls() {
            document.querySelectorAll("[data-font]").forEach((btn) => {
                btn.addEventListener("click", () => this.setFont(btn.getAttribute("data-font")));
            });

            document.querySelectorAll("[data-cb]").forEach((btn) => {
                btn.addEventListener("click", () => this.setColorblind(btn.getAttribute("data-cb")));
            });

            document.querySelectorAll("[data-toggle]").forEach((input) => {
                input.addEventListener("change", () => {
                    const key = input.getAttribute("data-toggle");
                    this.setToggle(key, input.checked);
                });
            });

            const resetBtn = document.getElementById("a11y-reset");
            if (resetBtn) {
                resetBtn.addEventListener("click", () => this.reset());
            }
        },

        syncControls() {
            document.querySelectorAll("[data-font]").forEach((btn) => {
                const isActive = parseInt(btn.getAttribute("data-font"), 10) === this.prefs.font;
                btn.classList.toggle("is-active", isActive);
                btn.setAttribute("aria-checked", isActive ? "true" : "false");
            });

            document.querySelectorAll("[data-cb]").forEach((btn) => {
                const isActive = btn.getAttribute("data-cb") === this.prefs.cb;
                btn.classList.toggle("is-active", isActive);
                btn.setAttribute("aria-checked", isActive ? "true" : "false");
            });

            document.querySelectorAll("[data-toggle]").forEach((input) => {
                const key = input.getAttribute("data-toggle");
                input.checked = !!this.prefs.toggles[key];
            });
        },

        toggleReadingGuide(enabled) {
            const guide = document.getElementById("reading-guide");
            if (!guide) return;
            guide.hidden = !enabled;

            if (enabled && !this._guideHandler) {
                this._guideHandler = (e) => {
                    guide.style.top = e.clientY + "px";
                };
                window.addEventListener("mousemove", this._guideHandler);
            } else if (!enabled && this._guideHandler) {
                window.removeEventListener("mousemove", this._guideHandler);
                this._guideHandler = null;
            }
        },

        handleReadingGuide() {
            if (this.prefs.toggles["reading-guide"]) {
                this.toggleReadingGuide(true);
            }
        }
    };

    window.A11y = A11y;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => A11y.init());
    } else {
        A11y.init();
    }
})();
