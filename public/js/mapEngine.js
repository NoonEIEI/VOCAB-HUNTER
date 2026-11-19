// Map Engine: Desktop Mouse + Mobile Touch Pan & Pinch-Zoom + Hit Detection
class MapEngine {
  constructor({ stageEl, wrapperEl, overlayEl, imgEl, onMapClick, onDevBoxDrawn }) {
    this.stageEl = stageEl;
    this.wrapperEl = wrapperEl;
    this.overlayEl = overlayEl;
    this.imgEl = imgEl;
    this.onMapClick = onMapClick;
    this.onDevBoxDrawn = onDevBoxDrawn;

    this.mapWidth = 2800;
    this.mapHeight = 1800;
    this.scale = 0.55;
    this.minScale = 0.28;
    this.maxScale = 2.4;
    this.panX = 0;
    this.panY = 0;

    this.isDragging = false;
    this.dragMoved = false;
    this.startX = 0;
    this.startY = 0;
    this.lastPinchDist = null;

    this.devMode = false;
    this.devStart = null;
    this.tempBoxEl = null;

    this.bindEvents();

    // เมื่อขนาดพื้นที่แสดงแผนที่เปลี่ยน (หมุนจอ/ย่อหน้าต่าง/เปิด-ปิดลิ้นชักบนมือถือ) ให้แผนที่ยังเต็มจอเสมอ
    if ("ResizeObserver" in window) {
      new ResizeObserver(() => this.handleResize()).observe(this.stageEl);
    } else {
      window.addEventListener("resize", () => this.handleResize());
    }
  }

  // สเกลที่ทำให้แผนที่ "เต็มพื้นที่พอดี" (ไม่มีขอบว่าง) = ซูมออกได้สุดแค่นี้
  getCoverScale() {
    const rect = this.stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return this.scale || 1;
    return Math.max(rect.width / this.mapWidth, rect.height / this.mapHeight);
  }

  updateScaleLimits() {
    const cover = this.getCoverScale();
    this.minScale = cover;
    this.maxScale = Math.max(cover * 4, 2.4);
  }

  handleResize() {
    const rect = this.stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const prevMin = this.minScale;
    this.updateScaleLimits();
    // ถ้าเดิมซูมออกสุดอยู่ ให้ยังซูมออกสุดหลังเปลี่ยนขนาด
    if (this.scale <= prevMin * 1.001 || this.scale < this.minScale) this.scale = this.minScale;
    this.applyTransform();
  }

  setMapDimensions(w, h) {
    this.mapWidth = w;
    this.mapHeight = h;
    this.wrapperEl.style.width = `${w}px`;
    this.wrapperEl.style.height = `${h}px`;
    this.resetView();
  }

  resetView() {
    const rect = this.stageEl.getBoundingClientRect();
    this.updateScaleLimits();
    this.scale = this.minScale;
    this.panX = (rect.width - this.mapWidth * this.scale) / 2;
    this.panY = (rect.height - this.mapHeight * this.scale) / 2;
    this.applyTransform();
  }

  zoomBy(delta, centerX = null, centerY = null) {
    const rect = this.stageEl.getBoundingClientRect();
    const cx = centerX !== null ? centerX - rect.left : rect.width / 2;
    const cy = centerY !== null ? centerY - rect.top : rect.height / 2;

    // ซูมแบบคูณ (สัดส่วนเท่ากันทุกระดับซูม)
    const oldScale = this.scale;
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, oldScale * (1 + delta)));
    if (Math.abs(newScale - oldScale) < 1e-6) return;

    const mapPointX = (cx - this.panX) / oldScale;
    const mapPointY = (cy - this.panY) / oldScale;

    this.scale = newScale;
    this.panX = cx - mapPointX * newScale;
    this.panY = cy - mapPointY * newScale;
    this.applyTransform();
  }

  // zoomFactor = ซูมกี่เท่าของมุมมองเต็มแผนที่
  centerOn(mapX, mapY, zoomFactor = 2) {
    const rect = this.stageEl.getBoundingClientRect();
    this.updateScaleLimits();
    this.scale = Math.min(this.maxScale, Math.max(this.scale, this.minScale * zoomFactor));
    this.panX = rect.width / 2 - mapX * this.scale;
    this.panY = rect.height / 2 - mapY * this.scale;
    this.applyTransform();
  }

  // ไม่ให้ลากจนเห็นพื้นที่ว่างนอกแผนที่
  clampPan() {
    const rect = this.stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const w = this.mapWidth * this.scale;
    const h = this.mapHeight * this.scale;
    this.panX = w <= rect.width ? (rect.width - w) / 2 : Math.min(0, Math.max(rect.width - w, this.panX));
    this.panY = h <= rect.height ? (rect.height - h) / 2 : Math.min(0, Math.max(rect.height - h, this.panY));
  }

  applyTransform() {
    this.clampPan();
    this.wrapperEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    const zoomLabel = document.getElementById("zoomThumb");
    // 100% = เห็นแผนที่เต็มจอ
    if (zoomLabel) zoomLabel.textContent = `${Math.round((this.scale / (this.minScale || this.scale)) * 100)}%`;
  }

  screenToMap(clientX, clientY) {
    const rect = this.stageEl.getBoundingClientRect();
    const x = (clientX - rect.left - this.panX) / this.scale;
    const y = (clientY - rect.top - this.panY) / this.scale;
    return { x: Math.round(x), y: Math.round(y) };
  }

  getTouchDistance(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  bindEvents() {
    this.stageEl.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      this.zoomBy(delta, e.clientX, e.clientY);
    }, { passive: false });

    this.stageEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;

      if (this.devMode) {
        this.devStart = this.screenToMap(e.clientX, e.clientY);
        this.tempBoxEl = document.createElement("div");
        this.tempBoxEl.className = "dev-hitbox";
        this.overlayEl.appendChild(this.tempBoxEl);
        return;
      }

      this.isDragging = true;
      this.dragMoved = false;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    window.addEventListener("mousemove", (e) => {
      if (this.devMode && this.devStart && this.tempBoxEl) {
        const curr = this.screenToMap(e.clientX, e.clientY);
        this.updateTempDevBox(this.devStart, curr);
        return;
      }

      if (!this.isDragging) return;
      const nextX = e.clientX - this.startX;
      const nextY = e.clientY - this.startY;
      if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 4) {
        this.dragMoved = true;
      }
      this.panX = nextX;
      this.panY = nextY;
      this.applyTransform();
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    window.addEventListener("mouseup", (e) => {
      if (this.devMode && this.devStart) {
        const curr = this.screenToMap(e.clientX, e.clientY);
        this.finishDevBox(this.devStart, curr);
        return;
      }

      if (!this.isDragging) return;
      this.isDragging = false;
      if (!this.dragMoved) {
        const coords = this.screenToMap(e.clientX, e.clientY);
        this.onMapClick?.(coords.x, coords.y);
      }
    });

    this.stageEl.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        this.isDragging = false;
        this.lastPinchDist = this.getTouchDistance(e.touches[0], e.touches[1]);
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (this.devMode) {
          this.devStart = this.screenToMap(touch.clientX, touch.clientY);
          this.tempBoxEl = document.createElement("div");
          this.tempBoxEl.className = "dev-hitbox";
          this.overlayEl.appendChild(this.tempBoxEl);
          return;
        }

        this.isDragging = true;
        this.dragMoved = false;
        this.downX = touch.clientX;
        this.downY = touch.clientY;
        this.startX = touch.clientX - this.panX;
        this.startY = touch.clientY - this.panY;
      }
    }, { passive: false });

    this.stageEl.addEventListener("touchmove", (e) => {
      e.preventDefault();

      if (e.touches.length === 2 && this.lastPinchDist) {
        const dist = this.getTouchDistance(e.touches[0], e.touches[1]);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const delta = (dist - this.lastPinchDist) * 0.0045;
        this.zoomBy(delta, midX, midY);
        this.lastPinchDist = dist;
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (this.devMode && this.devStart && this.tempBoxEl) {
          const curr = this.screenToMap(touch.clientX, touch.clientY);
          this.updateTempDevBox(this.devStart, curr);
          return;
        }

        if (!this.isDragging) return;
        const nextX = touch.clientX - this.startX;
        const nextY = touch.clientY - this.startY;
        if (Math.hypot(touch.clientX - this.downX, touch.clientY - this.downY) > 6) {
          this.dragMoved = true;
        }
        this.panX = nextX;
        this.panY = nextY;
        this.applyTransform();
        this.startX = touch.clientX - this.panX;
        this.startY = touch.clientY - this.panY;
      }
    }, { passive: false });

    this.stageEl.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        this.lastPinchDist = null;
      }

      if (this.devMode && this.devStart && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const curr = this.screenToMap(touch.clientX, touch.clientY);
        this.finishDevBox(this.devStart, curr);
        return;
      }

      if (this.isDragging && e.touches.length === 0) {
        this.isDragging = false;
        if (!this.dragMoved && e.changedTouches.length > 0) {
          const touch = e.changedTouches[0];
          const coords = this.screenToMap(touch.clientX, touch.clientY);
          this.onMapClick?.(coords.x, coords.y);
        }
      }
    });
  }

  updateTempDevBox(start, curr) {
    const x = Math.min(start.x, curr.x);
    const y = Math.min(start.y, curr.y);
    const w = Math.abs(curr.x - start.x);
    const h = Math.abs(curr.y - start.y);
    Object.assign(this.tempBoxEl.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`
    });
  }

  finishDevBox(start, curr) {
    const rect = {
      x: Math.min(start.x, curr.x),
      y: Math.min(start.y, curr.y),
      width: Math.abs(curr.x - start.x),
      height: Math.abs(curr.y - start.y)
    };
    this.tempBoxEl?.remove();
    this.tempBoxEl = null;
    this.devStart = null;
    if (rect.width > 20 && rect.height > 20) {
      this.onDevBoxDrawn?.(rect);
    }
  }

  spawnWrongRipple(x, y) {
    const el = document.createElement("div");
    el.className = "wrong-ripple";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.overlayEl.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  spawnRadarPulse(x, y) {
    this.overlayEl.querySelectorAll(".radar-pulse").forEach((n) => n.remove());
    const el = document.createElement("div");
    el.className = "radar-pulse";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.overlayEl.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  renderMarkers(quests, completedIds) {
    this.overlayEl.innerHTML = "";
    quests.forEach((q) => {
      if (completedIds.has(q.id)) {
        const box = document.createElement("div");
        box.className = "found-marker";
        Object.assign(box.style, {
          left: `${q.hitbox.x}px`,
          top: `${q.hitbox.y}px`,
          width: `${q.hitbox.width}px`,
          height: `${q.hitbox.height}px`
        });
        const label = document.createElement("div");
        label.className = "found-label";
        label.textContent = `✓ ${q.targetText}`;
        box.appendChild(label);
        this.overlayEl.appendChild(box);
      } else if (this.devMode) {
        const devBox = document.createElement("div");
        devBox.className = "dev-hitbox";
        Object.assign(devBox.style, {
          left: `${q.hitbox.x}px`,
          top: `${q.hitbox.y}px`,
          width: `${q.hitbox.width}px`,
          height: `${q.hitbox.height}px`
        });
        devBox.textContent = `${q.id}: ${q.targetText}`;
        this.overlayEl.appendChild(devBox);
      }
    });
  }
}

window.MapEngine = MapEngine;
