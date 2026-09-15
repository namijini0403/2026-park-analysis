'use strict';

/* Layout-only sizing. No school values, map methods, requests or saved data
   are changed. The existing map ResizeObserver handles canvas relayout. */
(() => {
  function init() {
    const workspace = document.getElementById('workspace-explore');
    const controls = document.getElementById('manager-map-controls');
    const selector = document.getElementById('manager-school-selector');
    const detail = document.getElementById('manager-school-details');
    const map = document.getElementById('school-map');
    const canvas = workspace?.querySelector('.map-canvas');
    if (!workspace || !controls || !selector || !detail || !map || !canvas) return;
    if (workspace.classList.contains('manager-resizable')) return;

    const mobile = matchMedia('(max-width: 780px)');
    const sizes = Object.create(null);
    const handles = [];
    let active = null;
    let frame = 0;
    let observedWidth = 0;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const viewportHeight = () => document.documentElement.clientHeight;
    const workspaceWidth = () => workspace.getBoundingClientRect().width;
    const sheetRange = () => [220, Math.max(220, viewportHeight() - 110)];
    const selectorHeightRange = () => [240, Math.max(240,
      viewportHeight() - Math.max(18, selector.getBoundingClientRect().top) - 18)];

    function variable(name, value) {
      const property = '--manager-' + name;
      if (value == null) workspace.style.removeProperty(property);
      else workspace.style.setProperty(property, Math.round(value) + 'px');
    }

    function updateHandle(config) {
      const [min, max] = config.range();
      const value = clamp(config.read(), min, max);
      config.element.setAttribute('aria-orientation', config.axis() === 'x' ? 'vertical' : 'horizontal');
      config.element.setAttribute('aria-valuemin', String(Math.round(min)));
      config.element.setAttribute('aria-valuemax', String(Math.round(max)));
      config.element.setAttribute('aria-valuenow', String(Math.round(value)));
      config.element.setAttribute('aria-valuetext', Math.round(value) + '픽셀');
    }

    function setSize(config, value) {
      const [min, max] = config.range();
      sizes[config.key()] = clamp(value, min, max);
      variable(config.key(), sizes[config.key()]);
      updateHandle(config);
    }

    function resetSize(config) {
      delete sizes[config.key()];
      variable(config.key(), null);
      updateHandle(config);
    }

    function finish(cancel = false) {
      if (!active) return;
      const previous = active;
      active = null;
      if (cancel) {
        if (previous.saved == null) resetSize(previous.config);
        else setSize(previous.config, previous.saved);
      }
      document.documentElement.classList.remove('manager-is-resizing');
      previous.config.element.classList.remove('is-dragging');
      if (previous.config.element.hasPointerCapture(previous.pointerId)) {
        previous.config.element.releasePointerCapture(previous.pointerId);
      }
    }

    function makeHandle(config, parent) {
      const element = document.createElement('div');
      element.id = config.id;
      element.className = 'manager-resize-handle ' + config.className;
      element.tabIndex = 0;
      element.setAttribute('role', 'separator');
      element.setAttribute('aria-label', config.label);
      element.setAttribute('aria-controls', config.controls);
      element.setAttribute('aria-describedby', 'manager-resize-help');
      element.title = config.label + ' · 드래그 또는 방향키 · 두 번 클릭하면 기본 크기';
      const grip = document.createElement('span');
      grip.className = 'manager-resize-grip';
      grip.setAttribute('aria-hidden', 'true');
      const caption = document.createElement('span');
      caption.className = 'manager-resize-caption';
      caption.textContent = config.caption;
      caption.setAttribute('aria-hidden', 'true');
      element.append(grip, caption);
      config.element = element;
      parent.append(element);
      handles.push(config);

      element.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0) return;
        finish();
        element.focus({ preventScroll: true });
        active = {
          config, pointerId: event.pointerId, saved: sizes[config.key()],
          origin: config.axis() === 'x' ? event.clientX : event.clientY,
          size: config.read(), axis: config.axis(), sign: config.sign()
        };
        element.setPointerCapture(event.pointerId);
        element.classList.add('is-dragging');
        document.documentElement.classList.add('manager-is-resizing');
        event.preventDefault();
      });
      element.addEventListener('pointermove', event => {
        if (!active || active.config !== config || active.pointerId !== event.pointerId) return;
        const position = active.axis === 'x' ? event.clientX : event.clientY;
        setSize(config, active.size + (position - active.origin) * active.sign);
      });
      element.addEventListener('pointerup', event => {
        if (active?.pointerId === event.pointerId && active.config === config) finish();
      });
      element.addEventListener('pointercancel', event => {
        if (active?.pointerId === event.pointerId && active.config === config) finish(true);
      });
      element.addEventListener('lostpointercapture', event => {
        if (active?.pointerId === event.pointerId && active.config === config) finish();
      });
      element.addEventListener('dblclick', () => resetSize(config));
      element.addEventListener('keydown', event => {
        if (event.key === 'Escape' && active) {
          event.preventDefault();
          event.stopPropagation();
          finish(true);
          return;
        }
        const [min, max] = config.range();
        const directions = config.axis() === 'x' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
        const direction = directions.indexOf(event.key);
        if (direction !== -1) {
          setSize(config, config.read() + (direction ? 1 : -1) * config.sign() * (event.shiftKey ? 64 : 24));
        } else if (event.key === 'Home') setSize(config, min);
        else if (event.key === 'End') setSize(config, max);
        else if (event.key === 'Enter') resetSize(config);
        else return;
        event.preventDefault();
        event.stopPropagation();
      });
      return element;
    }

    const help = document.createElement('p');
    help.id = 'manager-resize-help';
    help.textContent = '경계의 손잡이를 드래그해 크기를 조절하세요. 방향키로도 조절할 수 있습니다.';
    const reset = document.createElement('button');
    reset.id = 'manager-size-reset';
    reset.type = 'button';
    reset.textContent = '기본 크기';
    reset.addEventListener('click', () => {
      finish();
      Object.keys(sizes).forEach(key => { delete sizes[key]; variable(key, null); });
      handles.forEach(updateHandle);
    });
    controls.append(reset, help);

    makeHandle({
      id: 'manager-map-detail-resize', className: 'manager-resize-divider',
      label: '지도와 선택 학교 패널 너비 조절', caption: '↔',
      controls: map.id + ' ' + detail.id,
      axis: () => 'x', sign: () => -1, key: () => 'detail-width',
      range: () => [320, Math.max(320, Math.min(workspaceWidth() * .6, workspaceWidth() - 354))],
      read: () => sizes['detail-width'] ?? (detail.getBoundingClientRect().width || Math.min(440, Math.max(350, innerWidth * .3)))
    }, workspace);

    makeHandle({
      id: 'manager-map-height-resize', className: 'manager-resize-map-height',
      label: '지도 높이 조절', caption: '지도 높이 조절 ↕', controls: map.id,
      axis: () => 'y', sign: () => 1, key: () => 'map-height',
      range: () => [300, Math.max(480, Math.min(1200, viewportHeight() * 1.4))],
      read: () => sizes['map-height'] ?? map.getBoundingClientRect().height
    }, canvas);

    // The layer drawer can be widened independently without changing filters.
    makeHandle({
      id: 'manager-selector-width-resize', className: 'manager-resize-selector-width',
      label: '학교 선택·지도 레이어 패널 너비 조절', caption: '패널 너비 ↔', controls: selector.id,
      axis: () => 'x', sign: () => 1, key: () => 'selector-width',
      range: () => [280, Math.max(280, Math.min(600, workspaceWidth() - 32))],
      read: () => sizes['selector-width'] ?? (selector.getBoundingClientRect().width || 318)
    }, selector.querySelector('.manager-panel-controls'));

    [selector, detail].forEach(panel => {
      const prefix = panel === selector ? 'selector' : 'detail';
      makeHandle({
        id: 'manager-' + prefix + '-height-resize', className: 'manager-resize-panel-height',
        label: (prefix === 'detail' ? '선택 학교' : '학교 선택·지도 레이어') + ' 패널 높이 조절',
        caption: '패널 높이 조절 ↕', controls: panel.id,
        axis: () => 'y', sign: () => mobile.matches ? -1 : 1,
        key: () => prefix + (mobile.matches ? '-sheet-height' : '-height'),
        range: () => mobile.matches ? sheetRange() : prefix === 'selector' ? selectorHeightRange() : [240, Math.max(240, viewportHeight() - 36)],
        read: () => sizes[prefix + (mobile.matches ? '-sheet-height' : '-height')] ?? panel.getBoundingClientRect().height
      }, panel.querySelector('.manager-panel-controls'));
    });

    function refresh() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!workspace.getClientRects().length) return;
        variable('controls-height', controls.getBoundingClientRect().height);
        selector.style.setProperty('--manager-selector-limit', Math.round(selectorHeightRange()[1]) + 'px');
        handles.forEach(config => {
          if (sizes[config.key()] != null) setSize(config, sizes[config.key()]);
          else updateHandle(config);
        });
      });
    }
    workspace.classList.add('manager-resizable');
    new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (width === observedWidth) return;
      observedWidth = width;
      refresh();
    }).observe(workspace);
    new ResizeObserver(refresh).observe(controls);
    new MutationObserver(() => {
      if (active && (workspace.hidden || active.config.element.getClientRects().length === 0)) finish();
      refresh();
    }).observe(workspace, { attributes: true, attributeFilter: ['hidden', 'data-detail-open', 'data-selector-open'] });
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, { passive: true });
    window.addEventListener('blur', () => finish());
    mobile.addEventListener('change', () => { finish(); refresh(); });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
