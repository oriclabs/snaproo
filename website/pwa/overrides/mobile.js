// Snaproo PWA — Mobile overrides (touch support)
// This file is injected only in the PWA build for mobile device support.

// ── Touch-to-Mouse event forwarding ──────────────────────
// Makes all mousedown/mousemove/mouseup handlers work with touch
(function() {
  function touchHandler(event) {
    const touch = event.changedTouches[0];
    const type = { touchstart: 'mousedown', touchmove: 'mousemove', touchend: 'mouseup' }[event.type];
    if (!type) return;

    const mouseEvent = new MouseEvent(type, {
      bubbles: true, cancelable: true,
      clientX: touch.clientX, clientY: touch.clientY,
      screenX: touch.screenX, screenY: touch.screenY,
      button: 0, buttons: type === 'mouseup' ? 0 : 1,
    });
    touch.target.dispatchEvent(mouseEvent);

    // Prevent scroll/zoom during canvas interaction — but not on dropzones, buttons, inputs
    const tag = event.target.tagName;
    const isInteractive = tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'A' || tag === 'LABEL' ||
      event.target.closest('.dropzone') || event.target.closest('button') || event.target.closest('select');
    if (!isInteractive && (tag === 'CANVAS' || event.target.closest('.work-area'))) {
      event.preventDefault();
    }
  }
  document.addEventListener('touchstart', touchHandler, { passive: false });
  document.addEventListener('touchmove', touchHandler, { passive: false });
  document.addEventListener('touchend', touchHandler, { passive: false });
})();
