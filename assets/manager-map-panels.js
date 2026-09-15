'use strict';

/* Presentation-only map drawers. The original selection handlers, requests,
   filters, school values and map methods are intentionally left untouched. */
(() => {
  function init() {
    const workspace = document.getElementById('workspace-explore');
    const selector = workspace?.querySelector('.map-workspace .selector');
    const detail = workspace?.querySelector('.observation-section');
    const school = document.getElementById('school');
    const summary = document.getElementById('summary');
    const mapCanvas = document.getElementById('school-map');

    if (!workspace || !selector || !detail || !school || !summary) return;
    if (document.getElementById('manager-map-controls')) return;

    if (!selector.id) selector.id = 'manager-school-selector';
    if (!detail.id) detail.id = 'manager-school-details';

    function button(id, text, label) {
      const element = document.createElement('button');
      element.id = id;
      element.type = 'button';
      element.textContent = text;
      if (label) element.setAttribute('aria-label', label);
      return element;
    }

    const controls = document.createElement('div');
    controls.id = 'manager-map-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', '지도 화면 조절');

    const schoolToggle = button('manager-school-toggle', '학교 선택 · 레이어');
    schoolToggle.setAttribute('aria-controls', selector.id);
    const detailReopen = button('manager-detail-reopen', '선택 학교 상세');
    detailReopen.setAttribute('aria-controls', detail.id);
    controls.append(schoolToggle, detailReopen);

    const selectorBar = document.createElement('div');
    selectorBar.className = 'manager-panel-controls';
    const selectorClose = button('manager-selector-close', '닫기 ×', '학교 선택·레이어 패널 닫기');
    selectorBar.append(selectorClose);
    selector.prepend(selectorBar);

    const detailBar = document.createElement('div');
    detailBar.className = 'manager-panel-controls';
    const detailClose = button('manager-detail-close', '닫기 ×', '선택 학교 상세 패널 닫기');
    detailBar.append(detailClose);
    detail.prepend(detailBar);

    workspace.prepend(controls);
    workspace.classList.add('manager-map-layout');

    let selectedId = school.value;
    let selectorOpen = false;
    let detailOpen = Boolean(selectedId);
    let resizeFrame = 0;

    function visibleWorkspace() {
      return !workspace.hidden && workspace.getClientRects().length > 0;
    }

    function focusVisible(element) {
      if (!visibleWorkspace() || !element || element.hidden || element.closest('[inert]')) return;
      element.focus({ preventScroll: true });
    }

    function notifyLayout() {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        if (!visibleWorkspace()) return;
        // EducationMaps already observes its own container and relayouts while
        // preserving its center and zoom. This only notifies existing UI hooks;
        // no map.select(), fit(), center, level or SDK method is called here.
        window.dispatchEvent(new Event('resize'));
      });
    }

    function reflect() {
      workspace.dataset.selectorOpen = String(selectorOpen);
      workspace.dataset.detailOpen = String(detailOpen);
      selector.inert = !selectorOpen;
      detail.inert = !detailOpen;
      selector.setAttribute('aria-hidden', String(!selectorOpen));
      detail.setAttribute('aria-hidden', String(!detailOpen));
      schoolToggle.setAttribute('aria-expanded', String(selectorOpen));
      detailReopen.setAttribute('aria-expanded', String(detailOpen));
      detailReopen.hidden = !selectedId || detailOpen;
      notifyLayout();
    }

    function closeSelector(restoreFocus = true) {
      if (!selectorOpen) return;
      selectorOpen = false;
      reflect();
      if (restoreFocus) focusVisible(schoolToggle);
    }

    function closeDetail(restoreFocus = true) {
      if (!detailOpen) return;
      detailOpen = false;
      reflect();
      if (restoreFocus) focusVisible(selectedId ? detailReopen : schoolToggle);
    }

    function syncSelection({ explicit = false, focusDetail = false } = {}) {
      const nextId = school.value;
      const changed = nextId !== selectedId;
      selectedId = nextId;

      if (!selectedId) {
        const wasFocused = detail.contains(document.activeElement);
        detailOpen = false;
        reflect();
        if (wasFocused) focusVisible(schoolToggle);
        return;
      }

      // A marker can explicitly choose the same school again. It should reopen
      // the drawer. A profile response or radar redraw must not undo a manual
      // close; passive observation only reacts to an actual school-ID change.
      if (changed || explicit) {
        detailOpen = true;
        selectorOpen = false;
        reflect();
        if (focusDetail) focusVisible(detailClose);
      }
    }

    schoolToggle.addEventListener('click', () => {
      if (selectorOpen) {
        closeSelector();
      } else {
        selectorOpen = true;
        detailOpen = false;
        reflect();
        // Explicit opening enters the drawer, including the mobile bottom
        // sheet. Escape can now close it and restore focus to its trigger.
        focusVisible(selectorClose);
      }
    });

    selectorClose.addEventListener('click', () => closeSelector());
    detailClose.addEventListener('click', () => closeDetail());
    detailReopen.addEventListener('click', () => {
      if (!school.value) {
        syncSelection();
        return;
      }
      selectedId = school.value;
      detailOpen = true;
      selectorOpen = false;
      reflect();
      focusVisible(detailClose);
    });

    school.addEventListener('change', () => {
      const requestedId = school.value;
      const focused = document.activeElement;
      const focusDetail = selector.contains(focused) || Boolean(mapCanvas?.contains(focused));
      // Let the original change handler finish its selection/loading updates.
      queueMicrotask(() => {
        if (school.value === requestedId) syncSelection({ explicit: true, focusDetail });
      });
    }, true);

    workspace.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (detailOpen && detail.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        closeDetail();
      } else if (selectorOpen && selector.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        closeSelector();
      }
    });

    // URL-initial selection and filter-driven clearing call the original
    // select() directly, without dispatching change. Observe its existing DOM
    // output; no application function, property setter or history is patched.
    const selectionObserver = new MutationObserver(() => syncSelection());
    selectionObserver.observe(summary, { childList: true });
    selectionObserver.observe(school, { childList: true });

    const visibilityObserver = new MutationObserver(() => {
      if (!workspace.hidden) notifyLayout();
    });
    visibilityObserver.observe(workspace, { attributes: true, attributeFilter: ['hidden'] });

    // No selection starts with both drawers collapsed. If the original app
    // has already selected a school (including a URL), show its current output.
    reflect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
