// Snaproo - Custom dialog (replaces confirm/alert/prompt)
// Usage:
//   await pixDialog.alert('Title', 'Message');
//   const ok = await pixDialog.confirm('Title', 'Are you sure?');
//   const val = await pixDialog.prompt('Title', 'Enter value:', 'default');

const pixDialog = {
  _overlay: null,

  _create() {
    if (this._overlay) return;
    const o = document.createElement('div');
    o.id = 'pix-dialog-overlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(2,6,23,0.7);display:none;align-items:center;justify-content:center;';
    o.innerHTML = `
      <div id="pix-dialog" style="background:var(--slate-900,#0f172a);border:1px solid var(--slate-700,#334155);border-radius:12px;padding:1.25rem;min-width:280px;max-width:75vw;box-shadow:0 20px 60px rgba(0,0,0,0.5);font-family:Inter,system-ui,sans-serif;">
        <div id="pix-dialog-title" style="font-size:0.875rem;font-weight:600;color:var(--slate-200,#e2e8f0);margin-bottom:0.5rem;"></div>
        <div id="pix-dialog-body" style="font-size:0.8125rem;color:var(--slate-400,#94a3b8);line-height:1.5;margin-bottom:1rem;"></div>
        <input id="pix-dialog-input" type="text" style="display:none;width:100%;background:var(--slate-800,#1e293b);color:var(--slate-200,#e2e8f0);border:1px solid var(--slate-700,#334155);border-radius:6px;padding:6px 10px;font-size:0.8125rem;margin-bottom:0.75rem;outline:none;" />
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
          <button id="pix-dialog-cancel" style="display:none;background:var(--slate-800,#1e293b);color:var(--slate-300,#cbd5e1);border:1px solid var(--slate-700,#334155);border-radius:6px;padding:6px 16px;font-size:0.75rem;font-weight:500;cursor:pointer;">Cancel</button>
          <button id="pix-dialog-ok" style="background:#F4C430;color:#2A1E05;border:none;border-radius:6px;padding:6px 20px;font-size:0.75rem;font-weight:600;cursor:pointer;">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(o);
    this._overlay = o;
  },

  _show(title, body, options = {}) {
    this._create();
    const o = this._overlay;
    o.querySelector('#pix-dialog-title').textContent = title;
    // Support HTML in body (tables, styled content)
    const bodyEl = o.querySelector('#pix-dialog-body');
    if (body.includes('<')) { bodyEl.innerHTML = body; } else { bodyEl.textContent = body; }

    const input = o.querySelector('#pix-dialog-input');
    const cancelBtn = o.querySelector('#pix-dialog-cancel');
    const okBtn = o.querySelector('#pix-dialog-ok');

    input.style.display = options.prompt ? 'block' : 'none';
    if (options.prompt) input.value = options.defaultValue || '';

    cancelBtn.style.display = options.showCancel ? 'block' : 'none';
    okBtn.textContent = options.okText || 'OK';

    if (options.danger) {
      okBtn.style.background = '#ef4444';
      okBtn.style.color = '#ffffff';
    } else {
      okBtn.style.background = '#F4C430';
      okBtn.style.color = '#2A1E05';
    }

    o.style.display = 'flex';
    if (options.prompt) input.focus(); else okBtn.focus();

    return new Promise((resolve) => {
      const cleanup = (result) => {
        o.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        o.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };

      const onOk = () => cleanup(options.prompt ? input.value : true);
      const onCancel = () => cleanup(options.prompt ? null : false);
      const onBackdrop = (e) => { if (e.target === o) cleanup(options.prompt ? null : false); };
      const onKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); onOk(); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      o.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey);
    });
  },

  alert(title, message) {
    return this._show(title, message);
  },

  confirm(title, message, options = {}) {
    return this._show(title, message, { showCancel: true, ...options });
  },

  prompt(title, message, defaultValue = '') {
    return this._show(title, message, { prompt: true, showCancel: true, defaultValue });
  }
};
