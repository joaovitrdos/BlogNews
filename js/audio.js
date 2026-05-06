/* ==========================================================================
   Audio: Text-to-Speech (Web Speech API) + Sound FX (Howler.js)
   - TTS lê textos selecionados, alvos com data-read-target, ou frase
     completa sob o cursor (modo hover-tts).
   - Howler.js toca pequenos efeitos sonoros gerados via data URI (sem
     dependência de assets externos).
   ========================================================================== */

/* ------ Sound effects (Howler) ------ */
(function () {
    "use strict";

    function makeBeepDataUri(freq, durationMs, volume) {
        const sampleRate = 8000;
        const samples = Math.floor((sampleRate * durationMs) / 1000);
        const dataSize = samples * 2;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        function w(offset, str) {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        }

        w(0, "RIFF");
        view.setUint32(4, 36 + dataSize, true);
        w(8, "WAVE");
        w(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        w(36, "data");
        view.setUint32(40, dataSize, true);

        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const env = Math.min(1, (samples - i) / (sampleRate * 0.04));
            const v = Math.sin(2 * Math.PI * freq * t) * volume * env;
            view.setInt16(44 + i * 2, v * 32767, true);
        }

        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return "data:audio/wav;base64," + btoa(binary);
    }

    function loadSound(uri) {
        if (typeof Howl === "undefined") return null;
        try {
            return new Howl({ src: [uri], volume: 0.35, preload: true, html5: false });
        } catch (e) {
            return null;
        }
    }

    const sounds = {
        click: loadSound(makeBeepDataUri(880, 80, 0.4)),
        on: loadSound(makeBeepDataUri(1320, 90, 0.45)),
        off: loadSound(makeBeepDataUri(660, 90, 0.4)),
        open: loadSound(makeBeepDataUri(1100, 140, 0.35)),
        close: loadSound(makeBeepDataUri(550, 140, 0.3))
    };

    function play(name) {
        const s = sounds[name];
        if (s) {
            try { s.play(); } catch (e) { /* navegador pode bloquear até primeiro gesto */ }
        }
    }

    window.AudioFX = {
        click: () => play("click"),
        on: () => play("on"),
        off: () => play("off"),
        open: () => play("open"),
        close: () => play("close")
    };
})();

/* ------ Text-to-Speech ------ */
(function () {
    "use strict";

    const synth = window.speechSynthesis;
    const supported = !!synth;

    const fab = document.getElementById("tts-fab");
    let enabled = false;
    let hoverEnabled = false;
    let currentUtterance = null;
    let currentTriggerBtn = null;
    let lastHoverKey = "";
    let hoverTimer = null;

    function pickVoice() {
        if (!supported) return null;
        const voices = synth.getVoices();
        return voices.find((v) => /pt-BR/i.test(v.lang)) ||
               voices.find((v) => /pt/i.test(v.lang)) ||
               voices[0] || null;
    }

    function speak(text, triggerBtn, opts) {
        if (!supported || !text) return;
        stop();

        const options = opts || {};
        const utt = new SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) utt.voice = voice;
        utt.lang = voice ? voice.lang : "pt-BR";
        utt.rate = options.rate || 1;
        utt.pitch = options.pitch || 1;
        utt.volume = options.volume || 1;

        utt.onend = () => clearPlayingState();
        utt.onerror = () => clearPlayingState();

        currentUtterance = utt;
        currentTriggerBtn = triggerBtn || null;

        if (triggerBtn) triggerBtn.classList.add("is-playing");
        if (fab) fab.classList.add("is-playing");

        synth.speak(utt);
    }

    function stop() {
        if (!supported) return;
        if (synth.speaking || synth.pending) {
            synth.cancel();
        }
        clearPlayingState();
    }

    function clearPlayingState() {
        if (currentTriggerBtn) currentTriggerBtn.classList.remove("is-playing");
        if (fab) fab.classList.remove("is-playing");
        currentUtterance = null;
        currentTriggerBtn = null;
    }

    function getTextFromTarget(id) {
        const el = document.getElementById(id);
        if (!el) return "";
        return el.innerText || el.textContent || "";
    }

    function bindReadButtons() {
        document.querySelectorAll("[data-read-target]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                if (currentTriggerBtn === btn) {
                    stop();
                    return;
                }
                const targetId = btn.getAttribute("data-read-target");
                const text = getTextFromTarget(targetId);
                speak(text, btn);
            });
        });
    }

    function bindSelection() {
        document.addEventListener("mouseup", () => {
            if (!enabled || !fab) return;
            const sel = window.getSelection();
            const text = sel ? sel.toString().trim() : "";
            if (text.length > 1) {
                fab.hidden = false;
                fab.dataset.selectedText = text;
            } else {
                fab.hidden = true;
                delete fab.dataset.selectedText;
            }
        });

        if (fab) {
            fab.addEventListener("click", () => {
                if (currentUtterance) {
                    stop();
                    return;
                }
                const text = fab.dataset.selectedText || (window.getSelection() && window.getSelection().toString().trim());
                if (text) speak(text, fab);
            });
        }
    }

    function setEnabled(value) {
        enabled = !!value;
        if (!enabled && fab) {
            fab.hidden = true;
        }
        if (!enabled) stop();
    }

    /* ---------- Hover-to-Speak (frase completa) ---------- */
    const HOVER_IGNORE_SELECTOR = ".a11y-backdrop, .skip-link, .reading-guide, .tts-fab, .tts-fab *, script, style, svg, svg *";
    const HOVER_DELAY_MS = 260;
    const SENTENCE_END = /[.!?…\n]/;

    const BLOCK_TAGS = [
        "P", "LI", "BLOCKQUOTE",
        "H1", "H2", "H3", "H4", "H5", "H6",
        "A", "BUTTON", "LABEL", "LEGEND", "TIME",
        "DD", "DT", "FIGCAPTION", "TD", "TH",
        "SUMMARY", "ARTICLE", "SECTION"
    ];

    function getCaretInfo(x, y) {
        if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y);
            if (!pos) return null;
            return { node: pos.offsetNode, offset: pos.offset };
        }
        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(x, y);
            if (!range) return null;
            return { node: range.startContainer, offset: range.startOffset };
        }
        return null;
    }

    function findBlockAncestor(node) {
        let cur = node;
        if (cur && cur.nodeType === Node.TEXT_NODE) cur = cur.parentElement;
        let fallback = null;
        for (let i = 0; cur && i < 12; i++) {
            if (cur.matches && cur.matches(HOVER_IGNORE_SELECTOR)) return null;
            if (cur.tagName && BLOCK_TAGS.indexOf(cur.tagName) !== -1) return cur;
            if (!fallback && cur.tagName) {
                const inner = (cur.innerText || cur.textContent || "").trim();
                if (inner && inner.length > 1 && inner.length < 200) fallback = cur;
            }
            cur = cur.parentElement;
        }
        return fallback;
    }

    function normalize(text) {
        return (text || "").replace(/\s+/g, " ").trim();
    }

    function blockKey(el) {
        if (!el) return "";
        if (!el._a11yKey) el._a11yKey = Math.random().toString(36).slice(2, 10);
        return el._a11yKey;
    }

    function getSentenceAtPoint(x, y, fallbackEl) {
        const info = getCaretInfo(x, y);
        let textNode = info && info.node;
        let localOffset = info ? info.offset : 0;

        if (textNode && textNode.nodeType !== Node.TEXT_NODE) {
            const walker = document.createTreeWalker(textNode, NodeFilter.SHOW_TEXT, null);
            textNode = walker.nextNode();
            localOffset = 0;
        }

        const block = findBlockAncestor(textNode || fallbackEl);
        if (!block) return null;

        const fullText = normalize(block.innerText || block.textContent || "");
        if (!fullText || fullText.length < 2) return null;

        const bk = blockKey(block);

        if (fullText.length <= 240) {
            return { text: fullText, key: "blk:" + bk };
        }

        if (!textNode || !textNode.nodeValue) {
            return { text: fullText, key: "blk:" + bk };
        }

        const localText = textNode.nodeValue;
        const offset = Math.min(Math.max(localOffset, 0), localText.length);

        let start = offset;
        let end = offset;
        while (start > 0 && !SENTENCE_END.test(localText.charAt(start - 1))) start--;
        while (end < localText.length && !SENTENCE_END.test(localText.charAt(end))) end++;
        if (end < localText.length) end++;

        const sentence = normalize(localText.substring(start, end));
        if (sentence.length < 4) return { text: fullText, key: "blk:" + bk };
        return { text: sentence, key: "snt:" + bk + ":" + start };
    }

    function onHoverMove(e) {
        if (!hoverEnabled) return;
        const target = e.target;
        if (!target || (target.matches && target.matches(HOVER_IGNORE_SELECTOR))) return;

        const result = getSentenceAtPoint(e.clientX, e.clientY, target);
        if (!result || !result.text) return;
        if (result.key === lastHoverKey) return;

        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
            lastHoverKey = result.key;
            speak(result.text, null, { rate: 1.05 });
        }, HOVER_DELAY_MS);
    }

    function onHoverLeave() {
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
    }

    function attachHoverListeners() {
        document.addEventListener("mousemove", onHoverMove, { passive: true });
        document.addEventListener("mouseout", (e) => {
            if (!e.relatedTarget) onHoverLeave();
        });
    }

    function setHoverEnabled(value) {
        hoverEnabled = !!value;
        if (!hoverEnabled) {
            onHoverLeave();
            stop();
            lastHoverKey = "";
        }
    }

    if (supported && typeof synth.onvoiceschanged !== "undefined") {
        synth.onvoiceschanged = pickVoice;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            bindReadButtons();
            bindSelection();
            attachHoverListeners();
        });
    } else {
        bindReadButtons();
        bindSelection();
        attachHoverListeners();
    }

    window.addEventListener("beforeunload", stop);

    window.TTSManager = {
        speak,
        stop,
        setEnabled,
        setHoverEnabled,
        isSupported: () => supported
    };
})();
