// Word Arcade — ลานฝึกศัพท์ (มินิเกมทบทวนคำศัพท์ ไม่ต้องใช้แผนที่)
// โหมด: ฟังแล้วเลือกความหมาย / ไทย→อังกฤษ / เรียงตัวอักษร-เรียงประโยค / เติมคำในช่องว่าง / ผสมทุกแบบ
class VocabArcade {
  constructor(game) {
    this.game = game;
    this.QUESTION_COUNT = 10;
    this.MAX_HEARTS = 3;
    this.deckKey = "all";
    this.customDeck = null; // ใช้ตอนเปิดจากหน้าจบด่าน ("คำในรอบนี้")
    this.session = null;

    this.MODES = [
      { key: "mix", icon: "🎲", title: "ผสมทุกแบบ", desc: "สุ่มโจทย์ทุกประเภท 10 ข้อ", color: "mode-pink" },
      { key: "listen", icon: "🎧", title: "ฟังแล้วตอบ", desc: "ฟังเสียง แล้วเลือกความหมาย", color: "mode-sky" },
      { key: "meaning", icon: "🇹🇭", title: "ไทย → อังกฤษ", desc: "เห็นคำแปล เลือกคำอังกฤษ", color: "mode-mint" },
      { key: "spell", icon: "🔤", title: "เรียงให้ถูก", desc: "เรียงตัวอักษร / เรียงคำในประโยค", color: "mode-lemon" },
      { key: "fill", icon: "✏️", title: "เติมคำ", desc: "เลือกคำที่หายไปจากประโยค", color: "mode-grape" },
      { key: "mistakes", icon: "🧠", title: "คำที่เคยผิด", desc: "ทบทวนเฉพาะคำที่เคยตอบผิด", color: "mode-peach" }
    ];

    this.el = {
      screen: document.getElementById("arcadeScreen"),
      lobby: document.getElementById("arcadeLobby"),
      play: document.getElementById("arcadePlay"),
      result: document.getElementById("arcadeResult"),
      deckChips: document.getElementById("arcadeDeckChips"),
      modeGrid: document.getElementById("arcadeModeGrid"),
      bankCount: document.getElementById("arcadeBankCount"),
      hearts: document.getElementById("arcadeHearts"),
      progressFill: document.getElementById("arcadeProgressFill"),
      progressText: document.getElementById("arcadeProgressText"),
      score: document.getElementById("arcadeScore"),
      combo: document.getElementById("arcadeCombo"),
      card: document.getElementById("arcadeCard"),
      feedback: document.getElementById("arcadeFeedback")
    };

    const sub = document.getElementById("menuArcadeSub");
    if (sub) sub.textContent = `มินิเกม 5 แบบ • ${this.allItems().length} คำ`;
    document.getElementById("arcadeQuitBtn").addEventListener("click", () => this.finish(true));
    document.getElementById("arcadeBackBtn").addEventListener("click", () => this.close());
    document.addEventListener("keydown", (e) => this.onKey(e));
  }

  // ---------- data helpers ----------
  get bank() {
    return window.VOCAB_BANK || {};
  }

  allItems() {
    return Object.values(this.bank).flat();
  }

  findItem(id) {
    const fromBank = this.allItems().find((x) => x.id === id);
    if (fromBank) return fromBank;
    // fallback: quest ที่สร้างเองจาก Dev Mode (ไม่มีในคลัง)
    for (const lvl of this.game.levels) {
      const q = lvl.quests.find((x) => x.id === id);
      if (q) return { ...q, mapId: lvl.mapId, level: "—", exampleEN: null, exampleTH: null };
    }
    return null;
  }

  mistakeIds() {
    const sd = this.game.saveData;
    const ids = new Set([...Object.keys(sd.arcadeMistakes || {}), ...(sd.reviewQueue || [])]);
    return [...ids];
  }

  deckItems(key = this.deckKey) {
    if (key === "custom" && this.customDeck) return this.customDeck;
    if (key === "all") return this.allItems();
    return this.bank[key] || [];
  }

  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  shuffle(a) {
    return this.game.shuffleArray(a);
  }

  // ---------- lobby ----------
  open({ items = null, label = "" } = {}) {
    if (items && items.length) {
      this.customDeck = items.map((q) => this.findItem(q.id) || q);
      this.customLabel = label || "คำในรอบนี้";
      this.deckKey = "custom";
    } else if (this.deckKey === "custom" && !this.customDeck) {
      this.deckKey = "all";
    }
    this.showView("lobby");
    this.renderLobby();
    this.game.showScreen("arcadeScreen");
  }

  close() {
    this.session = null;
    this.game.showMenuScreen();
  }

  showView(name) {
    ["lobby", "play", "result"].forEach((v) => this.el[v].classList.toggle("hidden", v !== name));
    this.el.screen.scrollTop = 0;
  }

  renderLobby() {
    const titles = {};
    this.game.levels.forEach((l) => (titles[l.mapId] = l.titleTH.replace(/^ด่าน \d+:\s*/, "").replace(/\s*\(.*?\)/, "")));
    const icons = { amusement_park_01: "🎡", city_cafe_02: "☕", weekend_market_03: "🛍️", sunny_beach_04: "🏖️", school_05: "🏫" };
    const decks = [["all", "🌈", "ทุกฉาก", this.allItems().length]];
    if (this.customDeck) decks.unshift(["custom", "⭐", this.customLabel, this.customDeck.length]);
    Object.entries(this.bank).forEach(([id, items]) => decks.push([id, icons[id] || "🧭", titles[id] || id, items.length]));

    this.el.bankCount.textContent = this.allItems().length;
    this.el.deckChips.innerHTML = decks
      .map(([key, icon, name, n]) => `<button class="deck-chip ${key === this.deckKey ? "active" : ""}" data-deck="${key}"><span>${icon}</span><b>${this.esc(name)}</b><small>${n} คำ</small></button>`)
      .join("");
    this.el.deckChips.querySelectorAll("[data-deck]").forEach((b) =>
      b.addEventListener("click", () => {
        this.deckKey = b.dataset.deck;
        this.renderLobby();
      })
    );

    const best = this.game.saveData.arcadeBest || {};
    const mistakes = this.mistakeIds().length;
    this.el.modeGrid.innerHTML = this.MODES.map((m) => {
      const locked = m.key === "mistakes" && mistakes === 0;
      const sub = m.key === "mistakes" ? (mistakes ? `${mistakes} คำรอทบทวน` : "ยังไม่มีคำที่ผิด 🎉") : best[m.key] ? `สถิติสูงสุด ${best[m.key]} แต้ม` : "ยังไม่เคยเล่น";
      return `<button class="mode-card ${m.color}" data-mode="${m.key}" ${locked ? "disabled" : ""}>
        <span class="mode-icon">${m.icon}</span><b>${m.title}</b><small>${m.desc}</small><em>${sub}</em></button>`;
    }).join("");
    this.el.modeGrid.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => this.start(b.dataset.mode)));
  }

  // ---------- session ----------
  start(mode) {
    let pool;
    if (mode === "mistakes") {
      pool = this.mistakeIds().map((id) => this.findItem(id)).filter(Boolean);
    } else {
      pool = this.deckItems();
    }
    if (!pool.length) {
      this.game.showToast("ยังไม่มีคำในชุดนี้");
      return;
    }

    const picked = this.shuffle(pool).slice(0, Math.min(this.QUESTION_COUNT, pool.length));
    const questions = picked.map((item) => this.buildQuestion(item, mode === "mistakes" ? "mix" : mode, pool)).filter(Boolean);
    if (!questions.length) {
      this.game.showToast("ชุดคำนี้ยังใช้กับโหมดนี้ไม่ได้ ลองโหมดอื่นนะ");
      return;
    }

    this.session = { mode, questions, index: 0, score: 0, combo: 0, bestCombo: 0, correct: 0, hearts: this.MAX_HEARTS, missed: [], answered: false };
    this.showView("play");
    this.renderQuestion();
  }

  // เลือกชนิดโจทย์ที่ทำได้กับคำนั้นจริง ๆ
  possibleKinds(item) {
    const kinds = ["listen", "meaning"];
    if (this.canSpell(item)) kinds.push("spell");
    if (this.buildFill(item, [item])) kinds.push("fill");
    return kinds;
  }

  canSpell(item) {
    if (item.type === "word") return item.targetText.replace(/[^a-z]/gi, "").length <= 12;
    return item.targetText.split(/\s+/).length <= 9;
  }

  buildQuestion(item, mode, pool) {
    let kind = mode;
    if (mode === "mix") kind = this.shuffle(this.possibleKinds(item))[0];
    if (kind === "spell" && !this.canSpell(item)) kind = "meaning";

    const sameType = (list) => list.filter((x) => x.id !== item.id && x.type === item.type);
    const distractorPool = sameType(pool).length >= 3 ? sameType(pool) : sameType(this.allItems());

    if (kind === "listen") {
      const opts = this.pickDistinct(distractorPool, 3, (x) => x.meaningTH, item.meaningTH);
      return { kind, item, options: this.shuffle([item.meaningTH, ...opts]), answer: item.meaningTH };
    }
    if (kind === "meaning") {
      const opts = this.pickDistinct(distractorPool, 3, (x) => x.targetText, item.targetText);
      return { kind, item, options: this.shuffle([item.targetText, ...opts]), answer: item.targetText };
    }
    if (kind === "fill") {
      const fill = this.buildFill(item, distractorPool);
      if (fill) return { kind, item, ...fill };
      const opts = this.pickDistinct(distractorPool, 3, (x) => x.targetText, item.targetText);
      return { kind: "meaning", item, options: this.shuffle([item.targetText, ...opts]), answer: item.targetText };
    }
    if (kind === "spell") {
      if (item.type === "word") {
        const letters = item.targetText.replace(/[^a-z]/gi, "").toUpperCase().split("");
        let tiles = this.shuffle(letters);
        for (let i = 0; i < 5 && tiles.join("") === letters.join(""); i++) tiles = this.shuffle(letters);
        return { kind, item, spellMode: "letters", tiles, placed: [] };
      }
      const tokens = item.targetText.split(/\s+/);
      let tiles = this.shuffle(tokens);
      for (let i = 0; i < 5 && tiles.join(" ") === tokens.join(" "); i++) tiles = this.shuffle(tokens);
      return { kind, item, spellMode: "words", tiles, placed: [] };
    }
    return null;
  }

  pickDistinct(list, n, getter, exclude) {
    const seen = new Set([exclude.toLowerCase()]);
    const out = [];
    for (const x of this.shuffle(list)) {
      const v = getter(x);
      if (!v || seen.has(v.toLowerCase())) continue;
      seen.add(v.toLowerCase());
      out.push(v);
      if (out.length === n) break;
    }
    return out;
  }

  // สร้างโจทย์เติมคำ: คำศัพท์ → เว้นคำนั้นในประโยคตัวอย่าง, ประโยค → เว้นคำสำคัญ 1 คำ
  buildFill(item, distractorPool) {
    const STOP = new Set(["the", "this", "that", "these", "your", "have", "with", "from", "they", "there", "what", "please", "could", "would", "where", "here"]);
    if (item.type === "word") {
      if (!item.exampleEN) return null;
      const re = new RegExp(`\\b(${item.targetText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(e?s)?\\b`, "i");
      const m = item.exampleEN.match(re);
      if (!m) return null;
      const blanked = item.exampleEN.replace(re, "_____");
      const opts = this.pickDistinct(distractorPool, 3, (x) => x.targetText, item.targetText);
      if (opts.length < 2) return null;
      return { sentence: blanked, hint: item.exampleTH, options: this.shuffle([item.targetText, ...opts]), answer: item.targetText, full: item.exampleEN };
    }
    const tokens = item.targetText.split(/\s+/);
    const clean = (t) => t.replace(/[^a-z'-]/gi, "");
    const candidates = tokens
      .map((t, i) => ({ i, w: clean(t) }))
      .filter((x) => x.w.length >= 4 && !STOP.has(x.w.toLowerCase()))
      .sort((a, b) => b.w.length - a.w.length);
    if (!candidates.length) return null;
    const target = candidates[0];
    const words = new Set();
    this.allItems()
      .filter((x) => x.type === "sentence" && x.id !== item.id)
      .forEach((x) => x.targetText.split(/\s+/).map(clean).filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase())).forEach((w) => words.add(w.toLowerCase())));
    words.delete(target.w.toLowerCase());
    const opts = this.shuffle([...words]).slice(0, 3);
    if (opts.length < 3) return null;
    const answer = target.w.toLowerCase();
    const shown = tokens.map((t, i) => (i === target.i ? t.replace(target.w, "_____") : t)).join(" ");
    return { sentence: shown, hint: item.meaningTH, options: this.shuffle([answer, ...opts]), answer, full: item.targetText };
  }

  // ---------- render ----------
  renderHud() {
    const s = this.session;
    const total = s.questions.length;
    this.el.hearts.innerHTML = Array.from({ length: this.MAX_HEARTS }, (_, i) => `<span class="${i < s.hearts ? "" : "lost"}">❤</span>`).join("");
    this.el.progressFill.style.width = `${(s.index / total) * 100}%`;
    this.el.progressText.textContent = `${Math.min(s.index + 1, total)} / ${total}`;
    this.el.score.textContent = s.score;
    this.el.combo.classList.toggle("hidden", s.combo < 2);
    this.el.combo.textContent = `🔥 x${s.combo}`;
  }

  renderQuestion() {
    const s = this.session;
    const q = s.questions[s.index];
    s.answered = false;
    this.el.feedback.className = "arcade-feedback hidden";
    this.el.feedback.innerHTML = "";
    this.renderHud();

    const typeTag = `<span class="quest-tag ${q.item.type}">${q.item.type === "word" ? "คำศัพท์" : "ประโยค"}</span><span class="level-chip">${this.esc(q.item.level || "")}</span>`;
    let body = "";
    if (q.kind === "listen") {
      body = `<div class="arcade-kicker">🎧 ฟังแล้วเลือกความหมายที่ถูก</div>
        <div class="listen-buttons"><button class="big-speaker" data-say="1">🔊</button><button class="slow-speaker" data-say="0.6">🐢 ช้า</button></div>
        ${this.optionsHtml(q.options)}`;
    } else if (q.kind === "meaning") {
      body = `<div class="arcade-kicker">🇹🇭 ภาษาอังกฤษของคำนี้คืออะไร?</div>
        <div class="arcade-prompt th">${this.esc(q.item.meaningTH)}</div>${this.optionsHtml(q.options)}`;
    } else if (q.kind === "fill") {
      body = `<div class="arcade-kicker">✏️ เลือกคำที่หายไป</div>
        <div class="arcade-prompt">${this.esc(q.sentence).replace("_____", '<span class="gap">?</span>')}</div>
        <div class="arcade-hint">💡 ${this.esc(q.hint || "")}</div>${this.optionsHtml(q.options)}`;
    } else if (q.kind === "spell") {
      body = `<div class="arcade-kicker">🔤 ${q.spellMode === "letters" ? "เรียงตัวอักษรให้เป็นคำ" : "เรียงคำให้เป็นประโยค"}</div>
        <div class="arcade-hint">💡 ${this.esc(q.item.meaningTH)} <button class="tiny-speaker" data-say="1" title="ฟังเสียง">🔊</button></div>
        <div class="spell-slots ${q.spellMode}" id="spellSlots"></div>
        <div class="spell-tiles ${q.spellMode}" id="spellTiles"></div>
        <div class="spell-actions"><button class="ghost-btn" id="spellClear">↺ ล้าง</button></div>`;
    }
    this.el.card.innerHTML = `<div class="arcade-card-top">${typeTag}</div>${body}`;
    FX.pop(this.el.card, "fx-slide");

    this.el.card.querySelectorAll("[data-say]").forEach((b) =>
      b.addEventListener("click", () => this.game.speech.speak(q.item.targetText, Number(b.dataset.say) === 1 ? 0.92 : 0.6))
    );
    this.el.card.querySelectorAll("[data-opt]").forEach((b) => b.addEventListener("click", () => this.answerOption(b)));
    if (q.kind === "listen") setTimeout(() => this.game.speech.speak(q.item.targetText), 250);
    if (q.kind === "spell") {
      document.getElementById("spellClear").addEventListener("click", () => {
        if (s.answered) return;
        q.placed = [];
        this.renderSpell();
      });
      this.renderSpell();
    }
  }

  optionsHtml(options) {
    return `<div class="arcade-options">${options
      .map((o, i) => `<button class="arcade-option" data-opt="${this.esc(o)}"><kbd>${i + 1}</kbd><span>${this.esc(o)}</span></button>`)
      .join("")}</div>`;
  }

  renderSpell() {
    const q = this.session.questions[this.session.index];
    const slotsEl = document.getElementById("spellSlots");
    const tilesEl = document.getElementById("spellTiles");
    const usedIdx = new Set(q.placed);

    if (q.spellMode === "letters") {
      // ช่องตามรูปคำจริง (เว้นวรรค/ขีดแสดงไว้ให้)
      let li = 0;
      slotsEl.innerHTML = q.item.targetText
        .split("")
        .map((ch) => {
          if (!/[a-z]/i.test(ch)) return ch === " " ? `<span class="slot-gap"></span>` : `<span class="slot-fixed">${this.esc(ch)}</span>`;
          const tileIdx = q.placed[li];
          const pos = li++;
          return tileIdx === undefined
            ? `<span class="slot empty"></span>`
            : `<button class="slot filled" data-unplace="${pos}">${q.tiles[tileIdx]}</button>`;
        })
        .join("");
    } else {
      slotsEl.innerHTML = q.placed.length
        ? q.placed.map((tileIdx, pos) => `<button class="slot filled word" data-unplace="${pos}">${this.esc(q.tiles[tileIdx])}</button>`).join("")
        : `<span class="slot-placeholder">แตะคำด้านล่างเพื่อเรียงประโยค</span>`;
    }
    tilesEl.innerHTML = q.tiles
      .map((t, i) => `<button class="tile ${usedIdx.has(i) ? "used" : ""}" data-tile="${i}" ${usedIdx.has(i) ? "disabled" : ""}>${this.esc(t)}</button>`)
      .join("");

    tilesEl.querySelectorAll("[data-tile]").forEach((b) =>
      b.addEventListener("click", () => {
        if (this.session.answered) return;
        q.placed.push(Number(b.dataset.tile));
        this.game.sfx.tap();
        this.renderSpell();
        if (q.placed.length === q.tiles.length) this.checkSpell();
      })
    );
    slotsEl.querySelectorAll("[data-unplace]").forEach((b) =>
      b.addEventListener("click", () => {
        if (this.session.answered) return;
        q.placed.splice(Number(b.dataset.unplace), 1);
        this.renderSpell();
      })
    );
  }

  checkSpell() {
    const q = this.session.questions[this.session.index];
    const norm = (s) => s.toLowerCase().replace(/[^a-z' ]/g, "").replace(/\s+/g, " ").trim();
    let ok;
    if (q.spellMode === "letters") {
      ok = q.placed.map((i) => q.tiles[i]).join("") === q.item.targetText.replace(/[^a-z]/gi, "").toUpperCase();
    } else {
      ok = norm(q.placed.map((i) => q.tiles[i]).join(" ")) === norm(q.item.targetText);
    }
    document.getElementById("spellSlots").classList.add(ok ? "is-right" : "is-wrong");
    this.resolve(ok, document.getElementById("spellSlots"));
  }

  answerOption(btn) {
    const s = this.session;
    if (!s || s.answered) return;
    const q = s.questions[s.index];
    const ok = btn.dataset.opt.toLowerCase() === q.answer.toLowerCase();
    this.el.card.querySelectorAll("[data-opt]").forEach((b) => {
      b.disabled = true;
      if (b.dataset.opt.toLowerCase() === q.answer.toLowerCase()) b.classList.add("right");
    });
    if (!ok) btn.classList.add("wrong");
    this.resolve(ok, btn);
  }

  resolve(ok, anchorEl) {
    const s = this.session;
    const q = s.questions[s.index];
    s.answered = true;
    const sd = this.game.saveData;
    sd.arcadeMistakes = sd.arcadeMistakes || {};

    let gained = 0;
    if (ok) {
      s.combo += 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      s.correct += 1;
      gained = 10 + Math.min(s.combo - 1, 5) * 2;
      s.score += gained;
      delete sd.arcadeMistakes[q.item.id];
      s.combo >= 3 ? this.game.sfx.combo(s.combo) : this.game.sfx.found();
      const c = FX.centerOf(anchorEl);
      FX.burst(c.x, c.y, 16, 110);
      FX.floatText(c.x, c.y - 20, `+${gained}`, "#16a34a");
    } else {
      s.combo = 0;
      s.hearts -= 1;
      s.missed.push(q.item);
      sd.arcadeMistakes[q.item.id] = (sd.arcadeMistakes[q.item.id] || 0) + 1;
      this.game.sfx.miss();
      FX.pop(this.el.card, "fx-shake");
    }
    this.game.persistSaveData();
    this.renderHud();

    const it = q.item;
    const extra = q.kind === "fill" && q.full ? `<div class="fb-example">“${this.esc(q.full)}”</div>` : "";
    this.el.feedback.className = `arcade-feedback ${ok ? "ok" : "bad"}`;
    this.el.feedback.innerHTML = `
      <div class="fb-title">${ok ? (s.combo >= 3 ? `สุดยอด! คอมโบ ${s.combo} 🔥` : "ถูกต้อง! 🎉") : "ยังไม่ใช่ ไม่เป็นไรนะ 💪"}</div>
      <div class="fb-word"><b>${this.esc(it.targetText)}</b><button class="tiny-speaker" id="fbSay">🔊</button></div>
      <div class="fb-meta">${this.esc(it.phonetic || "")} · ${this.esc(it.meaningTH)}</div>${extra}
      <button class="arcade-next" id="arcadeNextBtn">${s.hearts <= 0 || s.index + 1 >= s.questions.length ? "ดูผลลัพธ์ 🏁" : "ข้อต่อไป →"}</button>`;
    document.getElementById("fbSay").addEventListener("click", () => this.game.speech.speak(it.targetText));
    document.getElementById("arcadeNextBtn").addEventListener("click", () => this.next());
    if (!ok) setTimeout(() => this.game.speech.speak(it.targetText), 350);
  }

  next() {
    const s = this.session;
    if (!s || !s.answered) return;
    if (s.hearts <= 0 || s.index + 1 >= s.questions.length) {
      s.index = Math.min(s.index + 1, s.questions.length);
      this.finish(false);
      return;
    }
    s.index += 1;
    this.renderQuestion();
  }

  onKey(e) {
    if (!this.session || this.el.play.classList.contains("hidden") || !this.el.screen.classList.contains("active")) return;
    if (e.target.tagName === "INPUT") return;
    if (/^[1-4]$/.test(e.key) && !this.session.answered) {
      const btn = this.el.card.querySelectorAll("[data-opt]")[Number(e.key) - 1];
      if (btn) btn.click();
    } else if ((e.key === "Enter" || e.key === " ") && this.session.answered) {
      e.preventDefault();
      this.next();
    }
  }

  // ---------- result ----------
  finish(quit) {
    const s = this.session;
    if (!s) return this.renderLobby();
    if (quit && s.index === 0 && !s.answered) {
      this.session = null;
      this.showView("lobby");
      this.renderLobby();
      return;
    }
    const total = s.questions.length;
    const pct = s.correct / total;
    const stars = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.4 ? 1 : 0;
    const sd = this.game.saveData;
    sd.arcadeBest = sd.arcadeBest || {};
    const isBest = s.score > (sd.arcadeBest[s.mode] || 0);
    if (isBest) sd.arcadeBest[s.mode] = s.score;
    sd.arcadeGames = (sd.arcadeGames || 0) + 1;
    sd.totalStars += s.score;
    this.game.persistSaveData();
    this.game.updateHUD();

    const msg = stars === 3 ? "เก่งสุด ๆ ไปเลย!" : stars === 2 ? "เยี่ยมมาก! อีกนิดเดียว" : stars === 1 ? "ดีขึ้นเรื่อย ๆ นะ" : "ไม่เป็นไร ลองอีกรอบ!";
    const missedUnique = [...new Map(s.missed.map((m) => [m.id, m])).values()];
    this.el.result.innerHTML = `
      <div class="result-card">
        <div class="result-stars">${[1, 2, 3].map((n) => `<span class="${n <= stars ? "on" : ""}" style="animation-delay:${n * 0.18}s">★</span>`).join("")}</div>
        <h2>${msg}</h2>
        <p>${s.hearts <= 0 ? "หัวใจหมดแล้ว — " : ""}ตอบถูก ${s.correct} จาก ${total} ข้อ</p>
        <div class="result-stats">
          <div><small>คะแนน</small><b>+${s.score} ⭐</b>${isBest && s.score > 0 ? "<em>สถิติใหม่!</em>" : ""}</div>
          <div><small>คอมโบสูงสุด</small><b>🔥 ${s.bestCombo}</b></div>
          <div><small>ความแม่นยำ</small><b>${Math.round(pct * 100)}%</b></div>
        </div>
        ${missedUnique.length ? `<div class="result-missed"><h3>คำที่ควรทบทวน</h3>${missedUnique
          .map((m, i) => `<button class="missed-chip" data-miss="${i}"><span>🔊</span><b>${this.esc(m.targetText)}</b><small>${this.esc(m.meaningTH)}</small></button>`)
          .join("")}</div>` : `<div class="result-perfect">ไม่มีคำผิดเลย 🎯</div>`}
        <div class="result-actions">
          <button class="cartoon-btn btn-mint" id="arcadeAgainBtn">🔁 เล่นอีกรอบ</button>
          ${missedUnique.length ? `<button class="cartoon-btn btn-yellow" id="arcadeMissBtn">🧠 ฝึกคำที่ผิด</button>` : ""}
          <button class="cartoon-btn btn-white" id="arcadeLobbyBtn">🎮 เลือกโหมด</button>
          <button class="cartoon-btn btn-white" id="arcadeHuntBtn">🗺️ ไปล่าคำบนแผนที่</button>
        </div>
      </div>`;
    this.showView("result");
    if (stars >= 2) {
      this.game.sfx.fanfare();
      FX.rain(stars === 3 ? 80 : 40);
    }

    this.el.result.querySelectorAll("[data-miss]").forEach((b) => b.addEventListener("click", () => this.game.speech.speak(missedUnique[Number(b.dataset.miss)].targetText)));
    const mode = s.mode;
    this.session = null;
    document.getElementById("arcadeAgainBtn").addEventListener("click", () => this.start(mode));
    document.getElementById("arcadeMissBtn")?.addEventListener("click", () => this.start("mistakes"));
    document.getElementById("arcadeLobbyBtn").addEventListener("click", () => {
      this.showView("lobby");
      this.renderLobby();
    });
    document.getElementById("arcadeHuntBtn").addEventListener("click", () => this.game.showGameScreen());
  }
}

window.VocabArcade = VocabArcade;
