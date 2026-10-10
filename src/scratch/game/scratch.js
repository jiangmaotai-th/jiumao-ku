export function createScratchController({ canvas, getTicketRect, radius, onScratch, onReveal, onComplete }) {
  let active = false;
  let last = null;
  let marks = [];
  let revealed = new Set();
  let completed = false;
  let scratchValue = 0;
  let lastSound = 0;
  let pointerId = null;

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function inTicket(point) {
    const t = getTicketRect();
    return point.x >= t.x && point.x <= t.x + t.w && point.y >= t.y && point.y <= t.y + t.h;
  }

  function down(event) {
    if (event.target.closest?.("button, [role='button'], .overlay")) return;
    const point = pointFromEvent(event);
    if (!inTicket(point) || completed) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointerId = event.pointerId;
    active = true;
    last = point;
    addMark(point, point, event.pressure || .55);
  }

  function move(event) {
    if (!active || completed) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    addMark(last, point, event.pressure || .55);
    last = point;
  }

  function up(event) {
    if (!active) return;
    active = false;
    last = null;
    pointerId = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    if (!completed) onScratch({ marks, check: true });
  }

  function addMark(from, to, pressure) {
    if (completed) return;
    const t = getTicketRect();
    const r = radius() * (.82 + Math.min(1, pressure) * .25);
    const mark = {
      x1: (from.x - t.x) / t.w, y1: (from.y - t.y) / t.h,
      x2: (to.x - t.x) / t.w, y2: (to.y - t.y) / t.h,
      r: r / t.w, seed: Math.random()
    };
    marks.push(mark);
    if (marks.length > 1200) marks = marks.slice(-1000);
    onScratch({ marks, mark, point: to, check: false });
    const now = performance.now();
    if (now - lastSound > 85) {
      lastSound = now;
      onScratch({ sound: true, velocity: Math.hypot(to.x - from.x, to.y - from.y) });
    }
  }

  function updateCoverage(slotCoverage, overall) {
    scratchValue = overall;
    slotCoverage.forEach((value, index) => {
      if (value >= .34 && !revealed.has(index)) {
        revealed.add(index);
        onReveal(index);
      }
    });
    const allRevealed = slotCoverage.length > 0 && revealed.size >= slotCoverage.length;
    onComplete(overall, allRevealed);
  }

  function reset() {
    marks = [];
    revealed = new Set();
    completed = false;
    scratchValue = 0;
    active = false;
    pointerId = null;
  }

  function setCompleted(value) {
    completed = value;
    if (value) {
      active = false;
      last = null;
      if (pointerId != null) {
        try { canvas.releasePointerCapture(pointerId); } catch { /* already released */ }
        pointerId = null;
      }
    }
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);

  return {
    reset, updateCoverage, setCompleted,
    get marks() { return marks; },
    get progress() { return scratchValue; },
    destroy() {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    }
  };
}
