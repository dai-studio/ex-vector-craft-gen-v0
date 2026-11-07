// Crosshair, hotbar, info readout and the click-to-play overlay (plain DOM).
import { HOTBAR, block, css } from './blocks.js';

/** A flat isometric cube in the block's colours. */
function cubeSvg(id) {
  const b = block(id);
  const top = css(b.top);
  const left = css(b.side, 0.82);
  const right = css(b.side, 0.68);
  const op = b.alpha < 1 ? Math.max(0.55, b.alpha) : 1;
  return `<svg class="cube" viewBox="0 0 32 32" aria-hidden="true" style="opacity:${op}">
    <polygon points="16,2 30,9 16,16 2,9" fill="${top}"/>
    <polygon points="2,9 16,16 16,30 2,23" fill="${left}"/>
    <polygon points="30,9 16,16 16,30 30,23" fill="${right}"/>
  </svg>`;
}

export class Hud {
  constructor(root, { onPlay, onNewWorld, onSelect }) {
    this.onSelect = onSelect;
    this.index = 0;
    root.innerHTML = `
      <div class="crosshair"></div>
      <div class="info"></div>
      <div class="slot-name"></div>
      <div class="hotbar">${HOTBAR.map((id, i) => `
        <div class="slot" data-i="${i}" title="${block(id).name}">
          <span class="key">${i + 1}</span>${cubeSvg(id)}
        </div>`).join('')}
      </div>
      <div class="overlay">
        <div class="card">
          <h1>VECTOR CRAFT</h1>
          <p>Click to play. Esc releases the mouse.</p>
          <table>
            <tr><td>Mouse</td><td>Look</td></tr>
            <tr><td>W A S D</td><td>Move</td></tr>
            <tr><td>Space</td><td>Jump / swim / fly up</td></tr>
            <tr><td>Shift</td><td>Sprint / fly down</td></tr>
            <tr><td>F</td><td>Toggle flying</td></tr>
            <tr><td>Left click</td><td>Break block</td></tr>
            <tr><td>Right click</td><td>Place block</td></tr>
            <tr><td>1-9 / wheel</td><td>Choose block</td></tr>
          </table>
          <div class="row">
            <span class="hint">Your world saves in this browser.</span>
            <button type="button" class="new-world">New world</button>
          </div>
        </div>
      </div>`;
    this.info = root.querySelector('.info');
    this.slotName = root.querySelector('.slot-name');
    this.slots = [...root.querySelectorAll('.slot')];
    this.overlay = root.querySelector('.overlay');

    this.overlay.addEventListener('click', e => {
      if (e.target.closest('.new-world')) {
        e.stopPropagation();
        if (confirm('Start a new world? Your current world and its edits will be lost.')) onNewWorld();
        return;
      }
      onPlay();
    });
    document.addEventListener('keydown', e => {
      const n = /^Digit([1-9])$/.exec(e.code);
      if (n) this.select(Number(n[1]) - 1);
    });
    document.addEventListener('wheel', e => {
      if (this.overlay.hidden) this.select(this.index + Math.sign(e.deltaY));
    }, { passive: true });
    this.select(0);
  }

  select(i) {
    this.index = ((i % HOTBAR.length) + HOTBAR.length) % HOTBAR.length;
    this.slots.forEach((s, k) => s.classList.toggle('selected', k === this.index));
    const id = HOTBAR[this.index];
    this.slotName.textContent = block(id).name;
    this.slotName.style.opacity = 1;
    clearTimeout(this.fade);
    this.fade = setTimeout(() => { this.slotName.style.opacity = 0; }, 1200);
    this.onSelect?.(id);
  }

  setInfo(text) {
    if (this.info.textContent !== text) this.info.textContent = text;
  }

  showOverlay(show) {
    this.overlay.hidden = !show;
  }
}
