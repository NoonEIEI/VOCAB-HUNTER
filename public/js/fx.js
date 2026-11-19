// FX: เอฟเฟกต์เล็ก ๆ ที่ใช้ร่วมกันทั้งเกม (คอนเฟตตี, ตัวเลขลอย, เด้ง)
// ทำด้วย DOM ล้วน ไม่ใช้ไลบรารีเพิ่ม และเคารพการตั้งค่า "ลดการเคลื่อนไหว"
(function () {
  const COLORS = ["#ff7eb6", "#ffd23f", "#5ad1e8", "#7be495", "#b69cff", "#ff9f5a"];

  function layer() {
    let el = document.getElementById("fxLayer");
    if (!el) {
      el = document.createElement("div");
      el.id = "fxLayer";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    return el;
  }

  const reduced = () => document.body.classList.contains("reduce-motion");

  // คอนเฟตตีพุ่งออกจากจุด (พิกัดหน้าจอ)
  function burst(x, y, count = 22, spread = 160) {
    if (reduced()) return;
    const host = layer();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      p.className = "fx-piece";
      const angle = Math.random() * Math.PI * 2;
      const dist = spread * (0.45 + Math.random() * 0.75);
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.background = COLORS[i % COLORS.length];
      p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(angle) * dist - 40}px`);
      p.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
      if (i % 3 === 0) p.style.borderRadius = "50%";
      host.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  }

  // ฝนคอนเฟตตีทั้งหน้าจอ (ใช้ตอนจบด่าน)
  function rain(count = 70) {
    if (reduced()) return;
    const host = layer();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      p.className = "fx-rain";
      p.style.left = `${Math.random() * 100}vw`;
      p.style.background = COLORS[i % COLORS.length];
      p.style.animationDelay = `${Math.random() * 0.9}s`;
      p.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
      p.style.setProperty("--rot", `${Math.random() * 900}deg`);
      host.appendChild(p);
      setTimeout(() => p.remove(), 4300);
    }
  }

  // ข้อความลอยขึ้น เช่น "+120 ⭐"
  function floatText(x, y, text, color = "#ff8a00") {
    const host = layer();
    const el = document.createElement("div");
    el.className = "fx-float";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    host.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // ทำให้ element เด้ง / สั่น
  function pop(el, cls = "fx-pop") {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 650);
  }

  window.FX = { burst, rain, floatText, pop, centerOf };
})();
