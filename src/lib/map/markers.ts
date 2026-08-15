export function buildPinElement(color: string): HTMLElement {
  const element = document.createElement('div');
  element.style.cssText = [
    'display:flex',
    'cursor:grab',
    'user-select:none',
    'touch-action:none',
    'filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))',
    'transition:filter 140ms ease'
  ].join(';');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 40');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '36');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = [
    'display:block',
    'transition:transform 140ms ease',
    'transform-origin:50% 100%'
  ].join(';');
  svg.innerHTML = [
    `<path d="M16 1.5C8.8 1.5 3 7.3 3 14.5 3 23 16 38.5 16 38.5 16 38.5 29 23 29 14.5 29 7.3 23.2 1.5 16 1.5Z" fill="${color}" stroke="rgba(15,23,42,0.85)" stroke-width="1.5"/>`,
    '<circle cx="16" cy="14" r="5.5" fill="white"/>',
    `<circle cx="16" cy="14" r="3" fill="${color}"/>`
  ].join('');
  element.appendChild(svg);
  return element;
}

export function buildAreaMarkerElement(letter: 'S' | 'E', color: string): HTMLElement {
  const element = document.createElement('div');
  element.style.cssText = [
    'display:flex',
    'cursor:grab',
    'user-select:none',
    'touch-action:none',
    'filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))',
    'transition:filter 140ms ease'
  ].join(';');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 40');
  svg.setAttribute('width', '26');
  svg.setAttribute('height', '34');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = [
    'display:block',
    'transition:transform 140ms ease',
    'transform-origin:50% 100%'
  ].join(';');
  svg.innerHTML = [
    `<path d="M16 2 C9 2 4 7 4 14 C4 22 16 38 16 38 C16 38 28 22 28 14 C28 7 23 2 16 2 Z" fill="${color}" stroke="rgba(15,23,42,0.85)" stroke-width="1.5"/>`,
    '<circle cx="16" cy="14" r="9" fill="white"/>',
    `<text x="16" y="19" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="${color}">${letter}</text>`
  ].join('');
  element.appendChild(svg);
  return element;
}

export function buildCameraElement(scale = 1): HTMLElement {
  const element = document.createElement('div');
  element.style.cssText = [
    'display:flex',
    'cursor:grab',
    'user-select:none',
    'touch-action:none',
    'filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))',
    'transition:filter 140ms ease'
  ].join(';');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 40');
  svg.setAttribute('width', String(28 * scale));
  svg.setAttribute('height', String(36 * scale));
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = [
    'display:block',
    'transition:transform 140ms ease',
    'transform-origin:50% 100%'
  ].join(';');
  svg.innerHTML = [
    `<path d="M16 1.5C8.8 1.5 3 7.3 3 14.5 3 23 16 38.5 16 38.5 16 38.5 29 23 29 14.5 29 7.3 23.2 1.5 16 1.5Z" fill="#ef4444" stroke="rgba(15,23,42,0.85)" stroke-width="1.5"/>`,
    '<circle cx="16" cy="14" r="5.5" fill="white"/>',
    '<circle cx="16" cy="14" r="3" fill="#ef4444"/>'
  ].join('');
  element.appendChild(svg);
  return element;
}

export function setMarkerActive(element: HTMLElement | null, isActive: boolean) {
  if (!element) {
    return;
  }
  element.setAttribute('data-marker-active', String(isActive));
  const svg = element.querySelector('svg');
  if (svg) {
    svg.style.transform = isActive ? 'scale(1.25)' : 'scale(1)';
  }
  element.style.filter = isActive
    ? 'drop-shadow(0 0 10px rgb(56 189 248 / 0.8)) drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))'
    : 'drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))';
}

export function buildCameraCanvas(color: string, size = 40): HTMLCanvasElement {
  const scale = 4;
  const width = size * scale;
  const height = size * scale;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    return canvas;
  }

  context.scale(scale, scale);

  context.lineJoin = 'round';
  context.lineCap = 'round';

  context.fillStyle = color;
  context.strokeStyle = 'rgba(15,23,42,0.85)';

  context.beginPath();
  context.moveTo(12, 7);
  context.lineTo(13, 4);
  context.lineTo(19, 4);
  context.lineTo(20, 7);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(7, 7);
  context.lineTo(25, 7);
  context.arc(25, 10, 3, -Math.PI / 2, 0);
  context.lineTo(28, 15);
  context.lineTo(28, 15 + 3);
  context.arc(25, 18, 3, 0, Math.PI / 2);
  context.lineTo(7, 21);
  context.arc(7, 18, 3, Math.PI / 2, Math.PI);
  context.lineTo(4, 10);
  context.arc(7, 10, 3, Math.PI, (3 * Math.PI) / 2);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(16, 12.5, 4.5, 0, 2 * Math.PI);
  context.fillStyle = 'white';
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(16, 12.5, 2.75, 0, 2 * Math.PI);
  context.fillStyle = color;
  context.fill();

  context.beginPath();
  context.moveTo(13, 21);
  context.lineTo(7, 35);
  context.moveTo(19, 21);
  context.lineTo(25, 35);
  context.moveTo(16, 21);
  context.lineTo(16, 35);
  context.strokeStyle = color;
  context.lineWidth = 2.2;
  context.stroke();

  for (const x of [7, 25, 16]) {
    context.beginPath();
    context.arc(x, 35, 1.5, 0, 2 * Math.PI);
    context.fillStyle = color;
    context.fill();
  }

  return canvas;
}
