// Main Game Controller for Vocab Hunter (Endless Pastel Scrapbook Edition)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem("vocab_hunter_sound") !== "false";
  }

  playTone(freq, type = "sine", duration = 0.15, delay = 0) {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration);
    } catch (_) {}
  }

  found() {
    this.playTone(523.25, "triangle", 0.14, 0);
    this.playTone(659.25, "triangle", 0.18, 0.1);
  }

  success() {
    this.playTone(523.25, "sine", 0.15, 0);
    this.playTone(659.25, "sine", 0.15, 0.1);
    this.playTone(783.99, "sine", 0.25, 0.2);
  }

  miss() {
    this.playTone(220, "sawtooth", 0.12, 0);
  }

  tap() {
    this.playTone(880, "sine", 0.05, 0);
  }

  combo(n = 3) {
    const base = 523.25 * Math.pow(1.06, Math.min(n, 10));
    this.playTone(base, "triangle", 0.1, 0);
    this.playTone(base * 1.25, "triangle", 0.1, 0.07);
    this.playTone(base * 1.5, "triangle", 0.16, 0.14);
  }

  fanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.playTone(f, "triangle", 0.22, i * 0.12));
    this.playTone(1318.5, "sine", 0.45, 0.5);
  }
}

class VocabHunterGame {
  constructor() {
    this.STORAGE_KEY = "vocab_hunter_endless_save_v3";
    this.levels = window.LEVELS_DATA || [];
    this.currentLevelIndex = 0;

    // 10 targets per round from the 14-18 item pool for endless replayability
    this.activeRoundQuests = [];
    this.previousRoundIds = new Set();
    this.completedIds = new Set();
    this.dailyMode = false;
    this.dailyTimer = null;
    this.dailySecondsLeft = 180;
    this.dailyExpired = false;
    this.roundStartedAt = Date.now();

    this.saveData = this.loadSaveData();
    this.mergeCustomQuests();
    this.enrichQuestsFromBank();

    // สถิติของรอบปัจจุบัน (ใช้ให้ดาว 1–3 ตอนจบรอบ)
    this.combo = 0;
    this.roundStats = { misses: 0, hints: 0, bestCombo: 0 };

    this.activeFilter = "all";
    this.audioHuntMode = false;
    this.activeQuest = null;
    this.pendingDevRect = null;

    this.speech = new SpeechEngine();
    this.sfx = new SoundFX();

    this.mapEngine = new MapEngine({
      stageEl: document.getElementById("mapStage"),
      wrapperEl: document.getElementById("mapCanvasWrapper"),
      overlayEl: document.getElementById("mapOverlay"),
      imgEl: document.getElementById("mapImage"),
      onMapClick: (x, y) => this.handleMapClick(x, y),
      onDevBoxDrawn: (rect) => this.openDevQuestModal(rect)
    });

    this.updateDailyStreak();
    this.initUI();
    this.arcade = new VocabArcade(this);
    this.loadLevel(0, false);
  }

  // เติมข้อมูลระดับคำ (A1/A2/B1) และประโยคตัวอย่างจากคลังคำศัพท์ให้ quest บนแผนที่
  enrichQuestsFromBank() {
    const bank = window.VOCAB_BANK || {};
    this.levels.forEach((lvl) => {
      const entries = bank[lvl.mapId] || [];
      lvl.quests.forEach((q) => {
        const e = entries.find((x) => x.id === q.id);
        if (e) {
          q.level = q.level || e.level;
          q.exampleEN = q.exampleEN || e.exampleEN;
          q.exampleTH = q.exampleTH || e.exampleTH;
        }
      });
    });
  }

  // แปลงพิกัดบนภาพแผนที่ → พิกัดบนหน้าจอ (ใช้วางเอฟเฟกต์)
  mapToScreen(x, y) {
    const rect = this.mapEngine.stageEl.getBoundingClientRect();
    return { x: rect.left + this.mapEngine.panX + x * this.mapEngine.scale, y: rect.top + this.mapEngine.panY + y * this.mapEngine.scale };
  }

  setCreatorMode(on) {
    document.body.classList.toggle("creator-mode", on);
    localStorage.setItem("vocab_hunter_creator", String(on));
    if (!on && this.mapEngine.devMode) document.getElementById("devModeBtn").click();
  }

  loadSaveData() {
    const defaultData = {
      totalStars: 0,
      radarTokens: 3,
      radarTokenProgress: 0,
      masteredCount: 0,
      streakDays: 1,
      lastPlayDate: new Date().toISOString().slice(0, 10),
      mapRounds: {},
      customQuests: {},
      recentQuestIds: {},
      lastRoundQuestIds: {},
      reviewQueue: [],
      mistakeCounts: {},
      accuracyTotal: 0,
      accuracyAttempts: 0,
      achievements: [],
      dailyCompletedDate: "",
      dailyBestStreak: 0,
      foundByMap: {}
    };
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return defaultData;
      const saved = JSON.parse(raw);
      return { ...defaultData, ...saved, recentQuestIds: saved.recentQuestIds || {}, lastRoundQuestIds: saved.lastRoundQuestIds || {}, reviewQueue: saved.reviewQueue || [], mistakeCounts: saved.mistakeCounts || {}, achievements: saved.achievements || [] };
    } catch (_) {
      return defaultData;
    }
  }

  persistSaveData() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.saveData));
    } catch (_) {}
  }

  mergeCustomQuests() {
    this.levels.forEach((lvl) => {
      const savedCustom = this.saveData.customQuests?.[lvl.mapId];
      if (Array.isArray(savedCustom) && savedCustom.length > 0) {
        lvl.quests.push(...savedCustom);
      }
    });
  }

  getLocalDateKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  updateDailyStreak() {
    const today = this.getLocalDateKey();
    const last = this.saveData.lastPlayDate;
    if (last !== today) {
      const diffMs = new Date(today) - new Date(last);
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        this.saveData.streakDays += 1;
      } else if (diffDays > 1) {
        this.saveData.streakDays = 1;
      }
      this.saveData.lastPlayDate = today;
      this.persistSaveData();
    }
  }

  get currentLevel() {
    return this.levels[this.currentLevelIndex];
  }

  getCurrentRoundNumber() {
    return this.saveData.mapRounds[this.currentLevel.mapId] || 1;
  }

  getRoundMultiplier() {
    const round = this.getCurrentRoundNumber();
    const audioBonus = this.audioHuntMode ? 0.5 : 0;
    return Number((1 + (round - 1) * 0.2 + audioBonus).toFixed(1));
  }

  getPlayerLevelInfo() {
    const lv = Math.floor(this.saveData.totalStars / 600) + 1;
    let rank = "นักเดินทางฝึกหัด";
    if (lv >= 10) rank = "ปรมาจารย์นักล่าภาษา";
    else if (lv >= 6) rank = "เซียนสนทนาพาสเทล";
    else if (lv >= 3) rank = "นักสะสมคำศัพท์";
    return { lv, rank };
  }

  initUI() {
    const levelSelect = document.getElementById("levelSelect");
    this.levels.forEach((lvl, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = lvl.titleTH;
      levelSelect.appendChild(opt);
    });

    levelSelect.addEventListener("change", (e) => {
      this.previousRoundIds.clear();
      this.loadLevel(Number(e.target.value), false);
    });

    document.getElementById("endlessShuffleBtn").addEventListener("click", () => {
      this.dailyMode = false;
      this.triggerEndlessShuffle();
    });
    document.getElementById("dailyChallengeBtn").addEventListener("click", () => this.startDailyChallenge());
    document.getElementById("reviewMistakesBtn").addEventListener("click", () => this.startReviewRound());

    const drawerToggle = document.getElementById("mobileDrawerToggle");
    const sidebar = document.getElementById("questSidebar");
    drawerToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      const statusText = document.getElementById("drawerStatusText");
      statusText.textContent = sidebar.classList.contains("collapsed")
        ? "📋 แตะเพื่อเปิดรายการคำศัพท์"
        : "📋 แตะเพื่อย่อแถบรายการ";
    });

    document.querySelectorAll(".paper-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".paper-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeFilter = btn.dataset.filter;
        this.renderQuestList();
      });
    });

    document.getElementById("audioHuntToggle").addEventListener("change", (e) => {
      this.audioHuntMode = e.target.checked;
      this.updateHUD();
      this.renderQuestList();
      if (this.audioHuntMode) {
        this.showToast("🎧 เปิดโหมดฟังเสียงปริศนา! แตะการ์ดเพื่อฟังเสียงแล้วหาในภาพ (+50% ดาว)");
      }
    });

    document.getElementById("zoomInBtn").addEventListener("click", () => this.mapEngine.zoomBy(0.3));
    document.getElementById("zoomOutBtn").addEventListener("click", () => this.mapEngine.zoomBy(-0.25));
    document.getElementById("resetViewBtn").addEventListener("click", () => this.mapEngine.resetView());
    document.getElementById("hintBtn").addEventListener("click", () => this.triggerRadarHint());

    document.getElementById("listenBtn").addEventListener("click", () => {
      if (this.activeQuest) this.speech.speak(this.activeQuest.targetText);
    });

    document.getElementById("micBtn").addEventListener("click", () => this.startSpeakingCheck());

    document.getElementById("fallbackCheckBtn").addEventListener("click", () => {
      const val = document.getElementById("fallbackInput").value;
      if (val.trim()) this.processSpokenText(val);
    });

    document.getElementById("closeModalBtn").addEventListener("click", () => {
      document.getElementById("speakModal").classList.add("hidden");
    });

    document.getElementById("nextRoundSameMapBtn").addEventListener("click", () => {
      document.getElementById("victoryModal").classList.add("hidden");
      this.loadLevel(this.currentLevelIndex, true);
    });

    document.getElementById("endlessNextMapBtn").addEventListener("click", () => {
      document.getElementById("victoryModal").classList.add("hidden");
      this.triggerEndlessShuffle();
    });

    const devBtn = document.getElementById("devModeBtn");
    devBtn.addEventListener("click", () => {
      this.mapEngine.devMode = !this.mapEngine.devMode;
      devBtn.classList.toggle("active", this.mapEngine.devMode);
      document.getElementById("mapStage").classList.toggle("dev-drawing", this.mapEngine.devMode);
      document.getElementById("devToolbar").classList.toggle("hidden", !this.mapEngine.devMode);
      const questsToRender = this.mapEngine.devMode ? this.currentLevel.quests : this.activeRoundQuests;
      this.mapEngine.renderMarkers(questsToRender, this.completedIds);
    });

    document.getElementById("customMapInput").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = document.getElementById("mapImage");
      img.onload = () => {
        this.currentLevel.mapImage = url;
        this.currentLevel.mapWidth = img.naturalWidth;
        this.currentLevel.mapHeight = img.naturalHeight;
        this.currentLevel.quests = [];
        this.activeRoundQuests = [];
        this.completedIds.clear();
        this.mapEngine.setMapDimensions(img.naturalWidth, img.naturalHeight);
        this.renderQuestList();
        this.updateHUD();
        this.showToast(`โหลดภาพแผนที่ใหม่ (${img.naturalWidth}x${img.naturalHeight}) แล้ว!`);
      };
      img.src = url;
    });

    document.getElementById("cancelDevQuestBtn").addEventListener("click", () => {
      document.getElementById("devQuestModal").classList.add("hidden");
    });

    document.getElementById("saveDevQuestBtn").addEventListener("click", () => this.saveNewDevQuest());

    document.getElementById("exportJsonBtn").addEventListener("click", () => {
      const jsonStr = JSON.stringify(this.currentLevel, null, 2);
      navigator.clipboard?.writeText(jsonStr);
      this.showToast("📋 คัดลอก JSON ด่านนี้ลง Clipboard แล้ว!");
    });

    // Main menu and supporting screens
    const showScreen = (id) => {
      document.querySelectorAll(".ui-screen").forEach((screen) => screen.classList.remove("active"));
      if (id) document.getElementById(id)?.classList.add("active");
    };
    this.showScreen = showScreen;
    this.showGameScreen = () => showScreen(null);
    this.showMenuScreen = () => { this.updateMenuSummary(); showScreen("mainMenuScreen"); };
    this.renderLevelCards();

    document.getElementById("menuContinueBtn").addEventListener("click", () => this.showGameScreen());
    document.getElementById("mainMenuBtn").addEventListener("click", () => this.showMenuScreen());
    document.getElementById("menuLevelsBtn").addEventListener("click", () => { this.renderLevelCards(); showScreen("levelSelectScreen"); });
    document.getElementById("menuDailyBtn").addEventListener("click", () => { this.showGameScreen(); this.startDailyChallenge(); });
    document.getElementById("menuEndlessBtn").addEventListener("click", () => { this.showGameScreen(); this.triggerEndlessShuffle(); });
    document.getElementById("menuStatsBtn").addEventListener("click", () => { this.updateStatsScreen(); showScreen("statsScreen"); });
    document.getElementById("menuHelpBtn").addEventListener("click", () => showScreen("helpScreen"));
    document.getElementById("menuSettingsBtn").addEventListener("click", () => showScreen("settingsScreen"));
    document.querySelectorAll("[data-back-menu]").forEach((btn) => btn.addEventListener("click", () => this.showMenuScreen()));

    document.getElementById("settingSoundToggle").checked = this.sfx.enabled;
    document.getElementById("settingSoundToggle").addEventListener("change", (e) => {
      this.sfx.enabled = e.target.checked;
      localStorage.setItem("vocab_hunter_sound", String(e.target.checked));
    });
    const motionToggle = document.getElementById("settingMotionToggle");
    motionToggle.checked = localStorage.getItem("vocab_hunter_reduce_motion") === "true";
    document.body.classList.toggle("reduce-motion", motionToggle.checked);
    motionToggle.addEventListener("change", (e) => {
      document.body.classList.toggle("reduce-motion", e.target.checked);
      localStorage.setItem("vocab_hunter_reduce_motion", String(e.target.checked));
    });

    // ปุ่มสร้างด่าน (Dev Mode) ซ่อนจากผู้เล่น — เปิดได้ในหน้าตั้งค่า
    const creatorToggle = document.getElementById("settingCreatorToggle");
    creatorToggle.checked = localStorage.getItem("vocab_hunter_creator") === "true";
    this.setCreatorMode(creatorToggle.checked);
    creatorToggle.addEventListener("change", (e) => this.setCreatorMode(e.target.checked));

    // ลานฝึกศัพท์ (มินิเกม)
    document.getElementById("menuArcadeBtn").addEventListener("click", () => this.arcade.open());
    document.getElementById("sceneArcadeBtn").addEventListener("click", () => {
      this.arcade.deckKey = this.currentLevel.mapId;
      this.arcade.open();
    });
    document.getElementById("hudArcadeBtn").addEventListener("click", () => this.arcade.open());
    document.getElementById("victoryArcadeBtn").addEventListener("click", () => {
      document.getElementById("victoryModal").classList.add("hidden");
      this.arcade.open({ items: this.activeRoundQuests, label: "คำในรอบที่เพิ่งเล่น" });
    });
  }

  updateMenuSummary() {
    const { lv, rank } = this.getPlayerLevelInfo();
    document.getElementById("menuRankName").textContent = rank;
    document.getElementById("menuLevelValue").textContent = `LEVEL ${lv}`;
    document.getElementById("menuStarValue").textContent = this.saveData.totalStars.toLocaleString();
  }

  updateStatsScreen() {
    document.getElementById("statsStars").textContent = this.saveData.totalStars.toLocaleString();
    document.getElementById("statsMastered").textContent = this.saveData.masteredCount.toLocaleString();
    document.getElementById("statsStreak").textContent = `${this.saveData.streakDays} วัน`;
    const accuracy = this.saveData.accuracyAttempts ? Math.round(this.saveData.accuracyTotal / this.saveData.accuracyAttempts) : null;
    document.getElementById("statsAccuracy").textContent = accuracy === null ? "—" : `${accuracy}%`;
    document.getElementById("statsAchievementCount").textContent = `${this.saveData.achievements.length} / 5`;
    const labels = [
      ["first10", "🌱 นักสะสม 10 คำ", "พูดผ่านครบ 10 คำ"],
      ["first50", "📚 นักสะสม 50 คำ", "พูดผ่านครบ 50 คำ"],
      ["first100", "🏆 นักสะสม 100 คำ", "พูดผ่านครบ 100 คำ"],
      ["streak3", "🔥 ต่อเนื่อง 3 วัน", "เข้าเล่นติดต่อกัน 3 วัน"],
      ["streak7", "💎 ต่อเนื่อง 7 วัน", "เข้าเล่นติดต่อกัน 7 วัน"]
    ];
    document.getElementById("statsAchievementList").innerHTML = labels.map(([id, title, desc]) => {
      const unlocked = this.saveData.achievements.includes(id);
      return `<article class="achievement-item ${unlocked ? "unlocked" : "locked"}"><span>${unlocked ? "🏅" : "🔒"}</span><div><b>${title}</b><small>${desc}</small></div><strong>${unlocked ? "ได้รับแล้ว" : "ยังไม่สำเร็จ"}</strong></article>`;
    }).join("");
  }

  renderLevelCards() {
    const grid = document.getElementById("levelCardsGrid");
    const META = {
      amusement_park_01: ["🎡", "ตามหาสิ่งของท่ามกลางเครื่องเล่นและผู้คน"],
      city_cafe_02: ["☕", "เดินเล่นในเมือง แวะคาเฟ่ และสังเกตสิ่งรอบตัว"],
      weekend_market_03: ["🛍️", "ออกตามหาของในตลาดที่เต็มไปด้วยสีสัน"],
      sunny_beach_04: ["🏖️", "สำรวจชายหาดยามเย็นและค้นหาของริมทะเล"],
      school_05: ["🏫", "ส่องห้องเรียน ห้องแล็บ โรงอาหาร และสนามเด็กเล่น"]
    };
    const icons = this.levels.map((l) => (META[l.mapId] || ["🧭"])[0]);
    const descriptions = this.levels.map((l) => (META[l.mapId] || [, "สำรวจฉากและค้นหาคำศัพท์"])[1]);
    grid.innerHTML = this.levels.map((lvl, idx) => {
      const round = this.saveData.mapRounds[lvl.mapId] || 1;
      const completed = this.saveData.lastRoundQuestIds[lvl.mapId]?.length || 0;
      return `<button class="level-select-card" data-level-index="${idx}"><span class="level-card-art" style="background-image:url('${lvl.mapImage}')"><i>${icons[idx] || "🧭"}</i><em>WORLD ${String(idx + 1).padStart(2, "0")}</em></span><span class="level-card-copy"><small>ADVENTURE ${String(idx + 1).padStart(2, "0")}</small><b>${lvl.titleTH.replace(/\s*\(.*?\)/, "")}</b><span>${descriptions[idx] || "สำรวจฉากและค้นหาคำศัพท์"}</span><strong>รอบที่ ${round} <i>•</i> เก็บแล้ว ${this.getFoundCount(lvl.mapId)}/${lvl.quests.length} คำ</strong></span><span class="level-card-arrow">→</span></button>`;
    }).join("");
    grid.querySelectorAll("[data-level-index]").forEach((card) => card.addEventListener("click", () => {
      const idx = Number(card.dataset.levelIndex);
      this.stopDailyTimer(); this.dailyMode = false; this.dailyExpired = false;
      this.previousRoundIds.clear(); document.getElementById("levelSelect").value = idx;
      this.loadLevel(idx, false); this.showGameScreen();
    }));
  }

  shuffleArray(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  getDifficultyInfo() {
    const accuracy = this.saveData.accuracyAttempts
      ? this.saveData.accuracyTotal / this.saveData.accuracyAttempts : 0;
    const mastered = this.saveData.masteredCount || 0;
    // ทุกระดับหา 10 เป้าหมายต่อรอบ (ฉากละ 40 = เล่น 4 รอบครบ) ต่างกันที่สัดส่วนประโยค
    if (mastered >= 35 && accuracy >= 82) return { key: "hard", label: "ท้าทาย", size: 10, sentenceRatio: 0.6 };
    if (mastered >= 12 && accuracy >= 65) return { key: "medium", label: "ปานกลาง", size: 10, sentenceRatio: 0.45 };
    return { key: "easy", label: "เริ่มต้น", size: 10, sentenceRatio: 0.3 };
  }

  pickEndlessRoundQuests(allQuests) {
    const size = Math.min(this.getDifficultyInfo().size, allQuests.length);
    const mapId = this.currentLevel?.mapId;
    const recent = new Set(this.saveData.recentQuestIds[mapId] || []);
    const lastRound = new Set(this.saveData.lastRoundQuestIds[mapId] || []);
    // คำที่ยังไม่เคยเก็บในฉากนี้มาก่อน → คำที่ไม่ได้อยู่รอบที่แล้ว → ที่เหลือ
    const found = new Set(this.saveData.foundByMap?.[mapId] || []);
    const notFound = this.shuffleArray(allQuests.filter(q => !found.has(q.id) && !lastRound.has(q.id)));
    const neverInLastRound = this.shuffleArray(allQuests.filter(q => found.has(q.id) && !lastRound.has(q.id)));
    const older = this.shuffleArray(allQuests.filter(q => lastRound.has(q.id)));
    const candidates = this.removeOverlapping([...notFound, ...neverInLastRound, ...older]);
    const targetSentences = Math.min(size, Math.round(size * this.getDifficultyInfo().sentenceRatio));
    const sentencePool = candidates.filter(q => q.type === "sentence");
    const wordPool = candidates.filter(q => q.type === "word");
    const selected = [];
    const clash = (q) => selected.some((k) => this.hitboxesOverlap(k.hitbox, q.hitbox));
    for (const q of sentencePool) { if (selected.length >= targetSentences) break; if (!clash(q)) selected.push(q); }
    for (const q of wordPool) { if (selected.length >= size) break; if (!clash(q)) selected.push(q); }
    if (selected.length < size) {
      const chosen = new Set(selected.map(q => q.id));
      for (const q of candidates) { if (selected.length >= size) break; if (!chosen.has(q.id) && !clash(q)) selected.push(q); }
    }
    const finalSelected = this.shuffleArray(selected);
    const ids = finalSelected.map(q => q.id);
    this.saveData.lastRoundQuestIds[mapId] = ids;
    this.saveData.recentQuestIds[mapId] = [...ids, ...[...recent].filter(id => !ids.includes(id))].slice(0, Math.max(size * 2, 16));
    this.persistSaveData();
    return finalSelected;
  }

  // เป้าหมายที่กรอบทับกัน (เช่น คำว่า Magician กับประโยคเรื่องนักมายากล) จะไม่ถูกสุ่มมาในรอบเดียวกัน
  // เพื่อให้แตะแล้วเปิดเป้าหมายที่ผู้เล่นตั้งใจหาจริง ๆ — ตัวที่ถูกข้ามจะไปต่อท้ายคิว
  hitboxesOverlap(a, b) {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    if (w <= 0 || h <= 0) return false;
    const smaller = Math.min(a.width * a.height, b.width * b.height);
    return (w * h) / smaller > 0.15;
  }

  removeOverlapping(list) {
    const kept = [], skipped = [];
    list.forEach((q) => (kept.some((k) => this.hitboxesOverlap(k.hitbox, q.hitbox)) ? skipped : kept).push(q));
    return [...kept, ...skipped];
  }

  getFoundCount(mapId) {
    const lvl = this.levels.find((l) => l.mapId === mapId);
    const ids = new Set(lvl ? lvl.quests.map((q) => q.id) : []);
    return (this.saveData.foundByMap?.[mapId] || []).filter((id) => ids.has(id)).length;
  }

  updateCollectionMeter() {
    const lvl = this.currentLevel;
    if (!lvl) return;
    const n = this.getFoundCount(lvl.mapId), total = lvl.quests.length;
    const el = document.getElementById("collectionMeter");
    if (!el) return;
    el.querySelector("b").textContent = `${n}/${total}`;
    el.querySelector(".collection-fill").style.width = `${total ? (n / total) * 100 : 0}%`;
  }

  seededShuffle(items, seed) {
    let state = seed >>> 0;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  getQuestById(id) {
    for (const level of this.levels) {
      const quest = level.quests.find(q => q.id === id);
      if (quest) return { quest, level };
    }
    return null;
  }

  startReviewRound() {
    const items = this.saveData.reviewQueue.map(id => this.getQuestById(id)).filter(Boolean);
    if (!items.length) {
      this.showToast("🎉 ไม่มีคำที่ต้องทบทวน ลองเล่นภารกิจปกติก่อนนะ!");
      return;
    }
    this.stopDailyTimer();
    this.dailyMode = false;
    const mapId = items[0].level.mapId;
    const idx = this.levels.findIndex(l => l.mapId === mapId);
    this.loadLevel(idx, false, items.filter(x => x.level.mapId === mapId).map(x => x.quest));
    this.showToast(`🧠 โหมดทบทวน: ${this.activeRoundQuests.length} คำที่เคยตอบผิด`);
  }

  startDailyChallenge() {
    const today = this.getLocalDateKey();
    if (this.saveData.dailyCompletedDate === today) {
      this.showToast("🌟 วันนี้ทำ Daily Challenge สำเร็จแล้ว กลับมาใหม่พรุ่งนี้นะ!");
      return;
    }
    this.stopDailyTimer();
    this.dailyMode = true;
    const seed = [...today].reduce((a,c) => a + c.charCodeAt(0), 0);
    const idx = seed % this.levels.length;
    const lvl = this.levels[idx];
    const quests = this.seededShuffle(lvl.quests, seed * 7919 + 37).slice(0, Math.min(8, lvl.quests.length));
    document.getElementById("levelSelect").value = idx;
    this.dailySecondsLeft = 180;
    this.dailyExpired = false;
    this.loadLevel(idx, false, quests);
    this.dailyMode = true;
    this.updateHUD();
    this.startDailyTimer();
    this.showToast("📅 Daily Challenge: หาให้ครบก่อนหมดเวลา 3 นาที!");
  }

  startDailyTimer() {
    this.stopDailyTimer();
    const status = document.getElementById("dailyStatus");
    const tick = () => {
      const m = Math.floor(this.dailySecondsLeft / 60);
      const sec = String(this.dailySecondsLeft % 60).padStart(2, "0");
      status.textContent = `⏱ Daily Challenge เหลือเวลา ${m}:${sec} • หา ${this.activeRoundQuests.length} สิ่ง`;
      if (this.dailySecondsLeft <= 0) {
        this.stopDailyTimer();
        this.dailyMode = false;
        this.dailyExpired = true;
        this.showToast("⏰ หมดเวลา Daily Challenge! ลองใหม่พรุ่งนี้ได้");
      } else this.dailySecondsLeft--;
    };
    tick();
    this.dailyTimer = setInterval(tick, 1000);
  }

  stopDailyTimer() {
    if (this.dailyTimer) clearInterval(this.dailyTimer);
    this.dailyTimer = null;
  }

  updateProgressionUI() {
    const difficulty = this.getDifficultyInfo();
    document.getElementById("difficultyLabel").textContent = difficulty.label;
    document.getElementById("reviewCount").textContent = this.saveData.reviewQueue.length;
    const names = { first10: "🌱 นักสะสม 10 คำ", first50: "📚 นักสะสม 50 คำ", first100: "🏆 นักสะสม 100 คำ", streak3: "🔥 ต่อเนื่อง 3 วัน", streak7: "💎 ต่อเนื่อง 7 วัน" };
    document.getElementById("achievementCount").textContent = `${this.saveData.achievements.length}/5`;
    const badges = document.getElementById("achievementBadges");
    badges.innerHTML = this.saveData.achievements.length
      ? this.saveData.achievements.map(id => `<span>${names[id] || "🏅 ความสำเร็จ"}</span>`).join("")
      : "<span>🌱 เริ่มสะสมคำศัพท์</span>";
  }

  checkAchievements() {
    const checks = [
      ["first10", this.saveData.masteredCount >= 10],
      ["first50", this.saveData.masteredCount >= 50],
      ["first100", this.saveData.masteredCount >= 100],
      ["streak3", this.saveData.streakDays >= 3],
      ["streak7", this.saveData.streakDays >= 7]
    ];
    const names = { first10: "นักสะสม 10 คำ", first50: "นักสะสม 50 คำ", first100: "นักสะสม 100 คำ", streak3: "เล่นต่อเนื่อง 3 วัน", streak7: "เล่นต่อเนื่อง 7 วัน" };
    checks.forEach(([id, ok]) => {
      if (ok && !this.saveData.achievements.includes(id)) {
        this.saveData.achievements.push(id);
        this.showToast(`🏅 ปลดล็อกความสำเร็จ: ${names[id]}!`);
      }
    });
    this.updateProgressionUI();
  }

  triggerEndlessShuffle() {
    this.stopDailyTimer();
    this.dailyMode = false;
    this.dailyExpired = false;
    let nextIdx = Math.floor(Math.random() * this.levels.length);
    if (this.levels.length > 1 && nextIdx === this.currentLevelIndex) {
      nextIdx = (this.currentLevelIndex + 1) % this.levels.length;
    }
    document.getElementById("levelSelect").value = nextIdx;
    this.loadLevel(nextIdx, true);
  }

  loadLevel(index, isEndlessNextRound = false, questOverride = null) {
    this.currentLevelIndex = index;
    this.completedIds.clear();
    const lvl = this.currentLevel;

    this.activeRoundQuests = questOverride ? [...questOverride] : this.pickEndlessRoundQuests(lvl.quests);
    this.roundStartedAt = Date.now();
    this.combo = 0;
    this.roundStats = { misses: 0, hints: 0, bestCombo: 0 };
    this.roundDone = false;
    this.updateCollectionMeter();

    const imgEl = document.getElementById("mapImage");
    imgEl.src = lvl.mapImage;
    this.mapEngine.setMapDimensions(lvl.mapWidth, lvl.mapHeight);

    const questsToRender = this.mapEngine.devMode ? lvl.quests : this.activeRoundQuests;
    this.mapEngine.renderMarkers(questsToRender, this.completedIds);

    this.renderQuestList();
    this.updateHUD();

    const roundNum = this.getCurrentRoundNumber();
    if (isEndlessNextRound) {
      this.showToast(`🎲 สุ่มภารกิจชุดใหม่! ${lvl.titleTH} (รอบที่ ${roundNum})`);
    } else {
      this.showToast(`เริ่ม ${lvl.titleTH} — อ่านภาษาอังกฤษแล้วหาเป้าหมาย ${this.activeRoundQuests.length} จุด!`);
    }
  }

  updateHUD() {
    const total = this.activeRoundQuests.length || 1;
    const done = this.completedIds.size;
    const pct = Math.round((done / total) * 100);

    document.getElementById("progressText").textContent = `${done} / ${this.activeRoundQuests.length}`;
    document.getElementById("progressBarFill").style.width = `${pct}%`;
    document.getElementById("scoreText").textContent = this.saveData.totalStars.toLocaleString();
    const radarTokensEl = document.getElementById("radarTokensText");
    if (radarTokensEl) radarTokensEl.textContent = this.saveData.radarTokens;
    const radarBadge = document.getElementById("radarBadge");
    if (radarBadge) radarBadge.textContent = this.saveData.radarTokens;
    const comboPill = document.getElementById("comboPill");
    if (comboPill) {
      comboPill.classList.toggle("hidden", this.combo < 2);
      document.getElementById("comboText").textContent = `x${this.combo}`;
    }
    const radarButton = document.getElementById("hintBtn");
    if (radarButton) {
      radarButton.disabled = this.saveData.radarTokens < 2;
      radarButton.classList.toggle("is-unavailable", this.saveData.radarTokens < 2);
      radarButton.title = this.saveData.radarTokens < 2
        ? "โทเคนไม่พอ: ต้องใช้ 2 โทเคนต่อครั้ง"
        : "ใช้เรดาร์ 2 โทเคนต่อครั้ง";
    }
    document.getElementById("streakText").textContent = `${this.saveData.streakDays} วัน`;

    const { lv, rank } = this.getPlayerLevelInfo();
    document.getElementById("playerLevelBadge").textContent = `LV.${lv}`;
    document.getElementById("playerRankText").textContent = rank;

    const roundNum = this.getCurrentRoundNumber();
    const mult = this.getRoundMultiplier();
    document.getElementById("ticketLevelTitle").textContent = this.currentLevel.titleTH;
    document.getElementById("roundBadgeText").textContent = `${this.dailyMode ? "Daily Challenge" : `รอบที่ ${roundNum}`} • ตัวคูณดาว x${mult}`;
    this.updateProgressionUI();
    this.updateMenuSummary();
  }

  renderQuestList() {
    const listEl = document.getElementById("questList");
    listEl.innerHTML = "";

    const filtered = this.activeRoundQuests.filter((q) => {
      if (this.activeFilter === "all") return true;
      return q.type === this.activeFilter;
    });

    filtered.forEach((q) => {
      const isDone = this.completedIds.has(q.id);
      const li = document.createElement("li");
      li.className = `quest-card ${isDone ? "completed" : ""}`;

      const hideEnglish = this.audioHuntMode && !isDone;
      const enHtml = hideEnglish
        ? `<div class="quest-en mystery-audio">🎧 แตะเพื่อฟังเสียงแล้วหาในภาพ</div>`
        : `<div class="quest-en">${q.targetText}</div>`;

      // Thai meaning is ONLY shown AFTER the player finds the object on the map!
      const unlockedMeaningHtml = isDone
        ? `<div class="quest-th-unlocked">💡 แปลว่า: ${q.meaningTH}</div>`
        : ``;

      li.innerHTML = `
        <div class="quest-card-header">
          <span class="quest-tag ${q.type}">${q.type === "word" ? "คำศัพท์" : "ประโยค"}</span>
          ${q.level ? `<span class="level-chip">${q.level}</span>` : ""}
          <span class="quest-status-sticker">${isDone ? "ผ่านแล้ว ✓" : "🔊 แตะฟัง / ค้นหา"}</span>
        </div>
        ${enHtml}
        ${unlockedMeaningHtml}
      `;

      li.addEventListener("click", () => {
        if (isDone) {
          const cx = q.hitbox.x + q.hitbox.width / 2;
          const cy = q.hitbox.y + q.hitbox.height / 2;
          this.mapEngine.centerOn(cx, cy, 2.2);
        } else {
          this.speech.speak(q.targetText);
          this.showToast(
            hideEnglish
              ? `🎧 กำลังเล่นเสียงปริศนา... ลองหาเป้าหมายในแผนที่ดูสิ!`
              : `🔊 ฟังเสียง: "${q.targetText}" แล้วหาในแผนที่!`
          );
        }
      });

      listEl.appendChild(li);
    });
  }

  handleMapClick(x, y) {
    if (this.dailyExpired) return;
    const inBox = (b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
    const foundQuest = this.activeRoundQuests.find((q) => {
      if (this.completedIds.has(q.id)) return false;
      return [q.hitbox, ...(q.altHitboxes || [])].some(inBox);
    });

    const screen = this.mapToScreen(x, y);
    if (foundQuest) {
      this.sfx.found();
      FX.burst(screen.x, screen.y, 26, 150);
      FX.floatText(screen.x, screen.y - 30, "เจอแล้ว!", "#7c3aed");
      setTimeout(() => this.openSpeakingModal(foundQuest), 380);
    } else {
      this.sfx.miss();
      this.mapEngine.spawnWrongRipple(x, y);
      this.roundStats.misses += 1;
      if (this.combo >= 2) this.showToast(`💨 คอมโบ x${this.combo} หลุดแล้ว! ลองดูให้ดีก่อนแตะนะ`);
      this.combo = 0;
      this.updateHUD();
    }
  }

  triggerRadarHint() {
    const RADAR_COST = 2;
    const remaining = this.activeRoundQuests.filter((q) => !this.completedIds.has(q.id));
    if (remaining.length === 0) {
      this.showToast("🎉 ค้นหาครบทุกเป้าหมายแล้ว!");
      return;
    }
    if ((this.saveData.radarTokens || 0) < RADAR_COST) {
      this.showToast("🪙 โทเคนไม่พอ! หาเป้าหมายให้ครบ 3 จุดเพื่อรับ 1 โทเคน");
      return;
    }

    this.saveData.radarTokens -= RADAR_COST;
    this.roundStats.hints += 1;
    this.persistSaveData();
    this.updateHUD();
    const target = remaining[0];
    const cx = target.hitbox.x + target.hitbox.width / 2;
    const cy = target.hitbox.y + target.hitbox.height / 2;

    this.mapEngine.centerOn(cx, cy, 2);
    this.mapEngine.spawnRadarPulse(cx, cy);
    this.showToast(
      this.audioHuntMode
        ? `📡 เรดาร์ชี้เป้าตำแหน่งเสียงปริศนาแล้ว!`
        : `📡 เรดาร์ชี้เป้า: "${target.targetText}"`
    );
  }

  openSpeakingModal(quest) {
    this.activeQuest = quest;
    document.getElementById("modalQuestType").textContent =
      quest.type === "word" ? "คำศัพท์" : "ประโยค";
    document.getElementById("modalTargetText").textContent = quest.targetText;
    document.getElementById("modalPhonetic").textContent = quest.phonetic || "ออกเสียงภาษาอังกฤษ";
    document.getElementById("modalMeaningTH").textContent = `เฉลยคำแปล: ${quest.meaningTH}`;

    document.getElementById("transcriptDisplay").classList.add("hidden");
    document.getElementById("fallbackInput").value = "";
    document.getElementById("speechStatus").textContent =
      "กดปุ่มสีรุ้งด้านบน แล้วพูดภาษาอังกฤษให้ชัดเจน";

    document.getElementById("speakModal").classList.remove("hidden");
    setTimeout(() => this.speech.speak(quest.targetText), 300);
  }

  startSpeakingCheck() {
    const micBtn = document.getElementById("micBtn");
    const micLabel = document.getElementById("micBtnLabel");
    const statusEl = document.getElementById("speechStatus");

    this.speech.listen({
      onInterim: (text) => {
        statusEl.textContent = `กำลังฟัง... "${text}"`;
      },
      onResult: (finalText) => {
        this.processSpokenText(finalText);
      },
      onError: (errMsg) => {
        statusEl.textContent = errMsg;
      },
      onEnd: () => {
        micBtn.classList.remove("listening");
        micLabel.textContent = "กดไมค์แล้วพูดใส่เครื่อง";
      }
    });

    if (this.speech.isListening) {
      micBtn.classList.add("listening");
      micLabel.textContent = "กำลังฟังเสียงคุณ... พูดเลย!";
      statusEl.textContent = "พูดประโยคภาษาอังกฤษใส่ไมโครโฟน...";
    }
  }

  processSpokenText(spokenText) {
    if (!this.activeQuest) return;
    const result = this.speech.evaluatePronunciation(this.activeQuest.targetText, spokenText);

    const box = document.getElementById("transcriptDisplay");
    const compEl = document.getElementById("wordComparison");
    const badgeEl = document.getElementById("accuracyBadge");

    box.classList.remove("hidden");
    compEl.innerHTML = "";

    result.wordResults.forEach((w) => {
      const span = document.createElement("span");
      span.className = `word-chip ${w.matched ? "match" : "miss"}`;
      span.textContent = w.word;
      compEl.appendChild(span);
    });

    this.saveData.accuracyTotal += result.score;
    this.saveData.accuracyAttempts += 1;
    if (result.passed) {
      this.sfx.success();
      const basePoints = this.activeQuest.type === "sentence" ? 150 : 100;
      // คอมโบ: หาเจอติดกันโดยไม่แตะผิด ได้โบนัส +10% ต่อขั้น (สูงสุด +50%)
      this.combo += 1;
      this.roundStats.bestCombo = Math.max(this.roundStats.bestCombo, this.combo);
      const comboBonus = 1 + Math.min(this.combo - 1, 5) * 0.1;
      const earnedStars = Math.round(basePoints * this.getRoundMultiplier() * comboBonus);

      badgeEl.style.color = "#15803D";
      badgeEl.textContent = `🎉 ยอดเยี่ยม! ความแม่นยำ ${result.score}% (+${earnedStars} ⭐${this.combo >= 2 ? ` • คอมโบ x${this.combo}` : ""})`;
      const scoreEl = document.querySelector(".score-capsule");
      if (scoreEl && scoreEl.offsetParent) {
        const c = FX.centerOf(scoreEl);
        FX.floatText(c.x, c.y + 26, `+${earnedStars} ⭐`, "#e08a00");
        setTimeout(() => FX.pop(scoreEl), 300);
      }
      const b = FX.centerOf(badgeEl);
      FX.burst(b.x, b.y, 18, 120);
      if (this.combo >= 3) this.sfx.combo(this.combo);

      this.completedIds.add(this.activeQuest.id);
      const fbm = (this.saveData.foundByMap = this.saveData.foundByMap || {});
      const mid = this.currentLevel.mapId;
      fbm[mid] = fbm[mid] || [];
      if (!fbm[mid].includes(this.activeQuest.id)) {
        fbm[mid].push(this.activeQuest.id);
        if (fbm[mid].length === this.currentLevel.quests.length) setTimeout(() => this.showToast(`🏆 สุดยอด! เก็บครบทั้ง ${fbm[mid].length} คำในฉากนี้แล้ว`), 1600);
      }
      this.saveData.totalStars += earnedStars;
      this.saveData.masteredCount += 1;
      this.saveData.radarTokenProgress = (this.saveData.radarTokenProgress || 0) + 1;
      if (this.saveData.radarTokenProgress >= 3) {
        this.saveData.radarTokenProgress -= 3;
        this.saveData.radarTokens = Math.min(9, (this.saveData.radarTokens || 0) + 1);
        this.showToast("🪙 เก่งมาก! รับเรดาร์โทเคนเพิ่ม 1 อัน (สะสมได้สูงสุด 9)");
      }
      this.saveData.reviewQueue = this.saveData.reviewQueue.filter(id => id !== this.activeQuest.id);
      this.checkAchievements();
      this.persistSaveData();
      this.updateCollectionMeter();

      this.updateHUD();
      this.renderQuestList();
      this.mapEngine.renderMarkers(this.activeRoundQuests, this.completedIds);

      setTimeout(() => {
        document.getElementById("speakModal").classList.add("hidden");
        if (this.completedIds.size === this.activeRoundQuests.length && !this.roundDone) {
          this.roundDone = true;
          this.handleRoundCompleted();
        }
      }, 1050);
    } else {
      this.sfx.miss();
      this.saveData.mistakeCounts[this.activeQuest.id] = (this.saveData.mistakeCounts[this.activeQuest.id] || 0) + 1;
      if (!this.saveData.reviewQueue.includes(this.activeQuest.id)) this.saveData.reviewQueue.push(this.activeQuest.id);
      this.persistSaveData();
      this.updateProgressionUI();
      badgeEl.style.color = "#DC2626";
      badgeEl.textContent = `😅 ความแม่นยำ ${result.score}% (ได้ยินว่า: "${result.spokenText}") — ลองกดฟังเสียงแล้วพูดอีกครั้ง!`;
    }
  }

  // ดาว 1–3 ตามความแม่น (แตะผิด) และการใช้เรดาร์
  renderVictoryExtras() {
    const { misses, hints, bestCombo } = this.roundStats;
    const stars = misses <= 3 && hints === 0 ? 3 : misses <= 8 && hints <= 1 ? 2 : 1;
    const secs = Math.round((Date.now() - this.roundStartedAt) / 1000);
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    document.getElementById("victoryStars").innerHTML = [1, 2, 3]
      .map((n) => `<span class="${n <= stars ? "on" : ""}" style="animation-delay:${0.15 + n * 0.2}s">★</span>`)
      .join("");
    document.getElementById("victoryStatsRow").innerHTML = `
      <div><small>เวลา</small><b>⏱ ${time}</b></div>
      <div><small>แตะผิด</small><b>❌ ${misses}</b></div>
      <div><small>ใช้เรดาร์</small><b>📡 ${hints}</b></div>
      <div><small>คอมโบสูงสุด</small><b>🔥 ${bestCombo}</b></div>`;
    document.getElementById("victoryWords").innerHTML = this.activeRoundQuests
      .map((q) => `<span title="${q.meaningTH.replace(/"/g, "&quot;")}">${q.targetText}</span>`)
      .join("");
    document.getElementById("victoryTip").textContent =
      stars === 3 ? "สมบูรณ์แบบ! หาเจอแทบไม่พลาดเลย" : stars === 2 ? "เกือบได้ 3 ดาวแล้ว — ลองแตะผิดให้น้อยกว่า 4 ครั้งและไม่ใช้เรดาร์" : "ได้ 3 ดาว: แตะผิดไม่เกิน 3 ครั้งและไม่ใช้เรดาร์";
    setTimeout(() => {
      this.sfx.fanfare();
      FX.rain(stars === 3 ? 60 : 30);
    }, 200);
  }

  handleRoundCompleted() {
    this.renderVictoryExtras();
    if (this.dailyMode) {
      this.stopDailyTimer();
      this.dailyMode = false;
      this.dailyExpired = false;
      const today = this.getLocalDateKey();
      this.saveData.dailyCompletedDate = today;
      this.saveData.totalStars += 250;
      this.persistSaveData();
      document.getElementById("victoryTitle").textContent = "Daily Challenge สำเร็จ!";
      document.getElementById("victorySummary").textContent = "คุณค้นหาครบทุกเป้าหมายภายในเวลาที่กำหนด";
      document.getElementById("victoryBonusText").textContent = "🎁 โบนัสพิเศษ +250 ดาว • ภารกิจวันนี้เสร็จแล้ว";
      document.getElementById("dailyStatus").textContent = "🌟 วันนี้ทำ Daily Challenge สำเร็จแล้ว!";
      this.updateHUD();
      document.getElementById("victoryModal").classList.remove("hidden");
      return;
    }
    const mapId = this.currentLevel.mapId;
    const clearedRound = this.getCurrentRoundNumber();
    const nextRound = clearedRound + 1;

    this.saveData.mapRounds[mapId] = nextRound;
    this.persistSaveData();

    const { lv, rank } = this.getPlayerLevelInfo();
    document.getElementById("victoryTitle").textContent =
      `ผ่าน ${this.currentLevel.titleTH} รอบที่ ${clearedRound} แล้ว!`;
    document.getElementById("victorySummary").textContent =
      `ปลดล็อกรอบที่ ${nextRound} (ตัวคูณคะแนนเพิ่มขึ้น!) • ยศปัจจุบัน: LV.${lv} ${rank}`;
    document.getElementById("victoryBonusText").textContent =
      `⭐ ดาวสะสม ${this.saveData.totalStars.toLocaleString()} | 🗣️ พูดผ่านสะสม ${this.saveData.masteredCount} ครั้ง`;

    this.checkAchievements();
    document.getElementById("victoryModal").classList.remove("hidden");
  }

  openDevQuestModal(rect) {
    this.pendingDevRect = rect;
    document.getElementById("devRectPreview").textContent =
      `พิกัดที่เลือก: x: ${rect.x}, y: ${rect.y}, width: ${rect.width}, height: ${rect.height}`;
    document.getElementById("devEnInput").value = "";
    document.getElementById("devPhoneticInput").value = "";
    document.getElementById("devThInput").value = "";
    document.getElementById("devQuestModal").classList.remove("hidden");
  }

  saveNewDevQuest() {
    if (!this.pendingDevRect) return;
    const en = document.getElementById("devEnInput").value.trim();
    if (!en) return;

    const newQuest = {
      id: `custom_${Date.now().toString().slice(-4)}`,
      type: document.getElementById("devTypeInput").value,
      targetText: en,
      phonetic: document.getElementById("devPhoneticInput").value.trim(),
      meaningTH: document.getElementById("devThInput").value.trim() || en,
      hitbox: this.pendingDevRect
    };

    const mapId = this.currentLevel.mapId;
    this.currentLevel.quests.push(newQuest);
    this.activeRoundQuests.push(newQuest);

    if (!this.saveData.customQuests[mapId]) {
      this.saveData.customQuests[mapId] = [];
    }
    this.saveData.customQuests[mapId].push(newQuest);
    this.persistSaveData();

    document.getElementById("devQuestModal").classList.add("hidden");
    this.renderQuestList();
    this.updateHUD();
    this.mapEngine.renderMarkers(this.currentLevel.quests, this.completedIds);
    this.showToast(`✅ บันทึก "${en}" ลงในด่านถาวรแล้ว!`);
  }

  showToast(msg) {
    const banner = document.getElementById("toastBanner");
    banner.textContent = msg;
    banner.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => banner.classList.add("hidden"), 3200);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.game = new VocabHunterGame();
});
