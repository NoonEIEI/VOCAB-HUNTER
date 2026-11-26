// Intro: ฉากเปิดเกม — โลโก้เด้งขึ้นมา ตัวอักษรเด้งทีละตัว แล้วแตะเพื่อเริ่ม
// (การแตะครั้งแรกยังช่วยปลดล็อกเสียงในเบราว์เซอร์ด้วย)
(function () {
  const screen = document.getElementById("introScreen");
  if (!screen) return;

  // ตั้งดีเลย์ให้ตัวอักษรเด้งทีละตัว
  screen.querySelectorAll(".intro-title b").forEach((el, i) => {
    el.style.animationDelay = `${0.95 + i * 0.07}s`;
  });

  // ประกายดาวตอนโลโก้ลงพื้น
  const logo = screen.querySelector(".intro-logo");
  setTimeout(() => {
    if (window.FX && logo) {
      const c = FX.centerOf(logo);
      FX.burst(c.x, c.y, 28, 190);
    }
  }, 620);

  let closing = false;
  function start() {
    if (closing) return;
    closing = true;
    try {
      window.game?.sfx?.fanfare();
    } catch (e) { /* ไม่มีเสียงก็เล่นต่อได้ */ }
    if (window.FX && logo) {
      const c = FX.centerOf(logo);
      FX.burst(c.x, c.y, 34, 240);
    }
    screen.classList.add("leaving");
    setTimeout(() => screen.remove(), 650);
    document.removeEventListener("keydown", onKey);
    // ต่อด้วยหน้าล็อกอิน (ถ้ายังไม่ล็อกอิน) — ถ้าเกมยังสร้างไม่เสร็จ ให้ app.js มาเช็กธงนี้เอง
    if (window.game?.afterIntro) window.game.afterIntro();
    else window.__vhIntroDone = true;
  }
  function onKey(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      start();
    }
  }

  // แตะตรงไหนก็ได้หลังโลโก้ขึ้นแล้ว
  screen.addEventListener("click", () => {
    if (screen.classList.contains("ready")) start();
  });
  document.getElementById("introStartBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    start();
  });
  document.addEventListener("keydown", onKey);

  const reduced = document.body.classList.contains("reduce-motion") || localStorage.getItem("vocab_hunter_reduce_motion") === "true";
  if (reduced) screen.classList.add("reduced");
  setTimeout(() => screen.classList.add("ready"), reduced ? 200 : 1900);
})();
