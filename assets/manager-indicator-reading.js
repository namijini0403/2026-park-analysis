'use strict';

/* Presentation-only enhancement of already-rendered indicator output.
   Original strings, nodes, SVG geometry and handlers stay intact. Comparisons
   normalize only bar lengths from the already-formatted display strings; they
   do not recalculate statistics, fetch data or replace application renderers. */
(() => {
  function init() {
    const summary = document.getElementById('summary');
    const savedList = document.getElementById('saved-list');
    const enhanced = new WeakSet();
    const organized = new WeakSet();
    const preparedDomains = new WeakSet();

    function label(className, text, tagName = 'span') {
      const element = document.createElement(tagName);
      element.className = className;
      element.textContent = text;
      return element;
    }

    function measurement(text) {
      if (typeof text !== 'string') return null;
      const match = text.trim().match(/^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(.*)$/);
      if (!match) return null;
      const value = Number(match[1].replaceAll(',', ''));
      return Number.isFinite(value) ? { value, unit: match[2], text: text.trim() } : null;
    }

    function compareValues(indicator, currentText) {
      const current = measurement(currentText);
      if (!current) return null;
      const rows = [{ name: '우리 학교', kind: 'school', ...current }];
      const spread = indicator.querySelector(':scope > .indicator-spread')?.textContent || '';
      const medianMatch = spread.match(/^전체 중앙값 (.+?) · 범위 /);
      const median = medianMatch && measurement(medianMatch[1]);
      if (median && median.unit === current.unit) rows.push({ name: '전체 중앙값', kind: 'overall', ...median });

      const districtText = indicator.querySelector(':scope > .indicator-gu')?.textContent || '';
      const districtMatch = districtText.match(/^(.+?) 백분위 .+? · .+? · 구 평균 (.+)$/);
      const district = districtMatch && measurement(districtMatch[2]);
      if (district && district.unit === current.unit) {
        rows.push({ name: `${districtMatch[1]} 평균`, kind: 'district', ...district });
      }
      // A suppressed small-sample mean, missing value or unknown format is not
      // invented or treated as zero. The original evidence remains available.
      if (rows.length < 2) return null;
      const lower = Math.min(0, ...rows.map(row => row.value));
      const upper = Math.max(0, ...rows.map(row => row.value));
      const span = upper - lower;
      if (!Number.isFinite(span)) return null;
      const position = value => span > 0 ? (value - lower) / span * 100 : 0;
      const origin = position(0);
      const figure = document.createElement('figure');
      figure.className = 'manager-value-comparison';
      const caption = label('manager-comparison-caption', '값 비교', 'figcaption');
      caption.append(label('manager-comparison-scale', '표시된 값 기준 · 같은 눈금'));
      figure.append(caption);
      for (const row of rows) {
        const element = document.createElement('div');
        element.className = `manager-comparison-row manager-comparison-${row.kind}`;
        element.append(label('manager-comparison-name', row.name), label('manager-comparison-value', row.text, 'strong'));
        const track = document.createElement('div');
        track.className = 'manager-comparison-track';
        track.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('span');
        fill.className = 'manager-comparison-fill';
        fill.style.left = `${Math.min(origin, position(row.value))}%`;
        fill.style.width = `${Math.abs(position(row.value) - origin)}%`;
        const zero = document.createElement('span');
        zero.className = 'manager-comparison-zero';
        zero.style.left = `${origin}%`;
        track.append(fill, zero);
        element.append(track);
        figure.append(element);
      }
      figure.append(label('manager-comparison-note', '반올림된 표시값을 비교합니다. 백분위·순위는 아래 원문에서 확인하세요.', 'p'));
      if (lower < 0) figure.append(label('manager-comparison-origin', '세로 눈금은 0 기준입니다.', 'p'));
      return figure;
    }

    function organizeDomains() {
      for (const domain of summary.querySelectorAll('.domain-card')) {
        const indicators = [...domain.querySelectorAll(':scope > .indicator')];
        if (!indicators.length) continue;
        if (!preparedDomains.has(domain)) {
          preparedDomains.add(domain);
          const tools = document.createElement('div');
          tools.className = 'manager-indicator-tools';
          const guide = label('manager-indicator-list-title', '지표 목록', 'strong');
          guide.append(label('manager-indicator-list-hint', '항목을 누르면 비교와 근거가 펼쳐집니다.'));
          tools.append(guide);
          const buttons = document.createElement('div');
          buttons.className = 'manager-indicator-list-actions';
          for (const [text, open] of [['모두 펼치기', true], ['모두 접기', false]]) {
            const button = label('manager-indicator-list-button', text, 'button');
            button.type = 'button';
            button.addEventListener('click', () => {
              for (const disclosure of domain.querySelectorAll('.manager-indicator-disclosure')) disclosure.open = open;
            });
            buttons.append(button);
          }
          tools.append(buttons);
          indicators[0].before(tools);
        }
        indicators.forEach((indicator, index) => {
          if (organized.has(indicator)) return;
          const originalLabel = indicator.querySelector(':scope > .indicator-label');
          const chart = indicator.querySelector(':scope > .manager-indicator-chart');
          if (!originalLabel) return;
          organized.add(indicator);
          indicator.classList.add('manager-indicator-row');
          // Missing reasons and text observations remain fully visible and do
          // not acquire an invented quantitative comparison or empty disclosure.
          if (!chart) return;
          const currentText = chart.querySelector('.manager-indicator-value')?.textContent;
          const direction = indicator.querySelector(':scope > .indicator-dir');
          const rank = chart.querySelector('.manager-indicator-rank')?.textContent;
          const comparison = compareValues(indicator, currentText);
          const disclosure = document.createElement('details');
          disclosure.className = 'manager-indicator-disclosure';
          disclosure.open = index === indicators.findIndex(row => row.querySelector('.manager-indicator-chart'));
          const heading = document.createElement('summary');
          heading.className = 'manager-indicator-summary';
          const copy = document.createElement('span');
          copy.className = 'manager-indicator-summary-copy';
          const name = document.createElement('span');
          name.className = 'manager-indicator-summary-name';
          name.append(label('manager-indicator-index', String(index + 1).padStart(2, '0')), originalLabel);
          copy.append(name);
          if (direction) copy.append(direction);
          const values = document.createElement('span');
          values.className = 'manager-indicator-summary-data';
          values.append(label('manager-indicator-summary-value', currentText || '', 'strong'));
          if (rank) values.append(label('manager-indicator-summary-rank', rank));
          const arrow = document.createElement('span');
          arrow.className = 'manager-indicator-caret';
          arrow.setAttribute('aria-hidden', 'true');
          heading.append(copy, values, arrow);
          const body = document.createElement('div');
          body.className = 'manager-indicator-body';
          if (comparison) body.append(comparison);
          const evidence = document.createElement('details');
          evidence.className = 'manager-indicator-evidence';
          evidence.open = !comparison;
          evidence.append(label('manager-indicator-evidence-heading', '백분위 · 범위 · 자세한 근거', 'summary'));
          evidence.append(chart);
          // Move, never rewrite, every remaining original note/observation node.
          evidence.append(...indicator.childNodes);
          body.append(evidence);
          disclosure.append(heading, body);
          indicator.append(disclosure);
        });
      }
    }

    function enhanceIndicators() {
      if (!summary) return;
      for (const svg of summary.querySelectorAll('.indicator > svg.pct-bar')) {
        if (enhanced.has(svg) || svg.closest('.manager-indicator-chart')) continue;
        const valueNode = svg.querySelector('.pct-value');
        const metaNodes = [...svg.querySelectorAll('.pct-meta')];
        if (!valueNode || !metaNodes.length) continue;

        enhanced.add(svg);
        const chart = document.createElement('div');
        chart.className = 'manager-indicator-chart';
        const originalDescription = svg.getAttribute('aria-label');
        if (originalDescription) {
          chart.setAttribute('role', 'group');
          chart.setAttribute('aria-label', originalDescription);
        }

        const heading = document.createElement('div');
        heading.className = 'manager-indicator-heading';
        heading.append(
          label('manager-indicator-value', valueNode.textContent, 'strong'),
          label('manager-indicator-percentile', metaNodes[0].textContent)
        );

        const footer = document.createElement('div');
        footer.className = 'manager-indicator-footer';
        for (let index = 1; index < metaNodes.length; index += 1) {
          footer.append(label('manager-indicator-rank', metaNodes[index].textContent));
        }

        // The renderer's district-marker tooltip is also available as an
        // accessible HTML note. The original title remains in the SVG intact.
        for (const title of svg.querySelectorAll('title')) {
          footer.append(label('manager-indicator-marker-note', title.textContent));
        }

        const copiedNodes = new Set([valueNode, ...metaNodes]);
        for (const text of svg.querySelectorAll('text')) {
          if (!copiedNodes.has(text)) {
            footer.append(label('manager-indicator-extra-label', text.textContent));
          }
        }

        // Retain the complete original SVG, including its original viewBox.
        // CSS crops this new wrapper; no geometry or numbers are recalculated.
        const track = document.createElement('div');
        track.className = 'manager-indicator-track';
        svg.before(chart);
        chart.append(heading, track, footer);
        track.append(svg);
        svg.setAttribute('aria-hidden', 'true');
      }
      organizeDomains();
    }

    const originalEmptyMessage = '저장된 대화가 없습니다. ‘02 자료에 묻기’에서 질문한 뒤 ‘대화 저장하기’를 누르세요.';
    const renamedEmptyMessage = '저장된 대화가 없습니다. ‘02 AI 도우미’에서 질문한 뒤 ‘대화 저장하기’를 누르세요.';

    function syncEmptyNavigationName() {
      if (!savedList) return;
      // This one exact, application-authored empty-state sentence is the only
      // authorized copy alias. Never inspect or rewrite saved conversation text.
      for (const empty of savedList.querySelectorAll(':scope > .saved-empty')) {
        if (empty.children.length === 0 && empty.textContent === originalEmptyMessage) {
          empty.textContent = renamedEmptyMessage;
        }
      }
    }

    if (summary) {
      const indicatorObserver = new MutationObserver(enhanceIndicators);
      indicatorObserver.observe(summary, { childList: true, subtree: true });
      enhanceIndicators();
      // Keep previously visible indicator content printable, then restore the
      // user's reading layout. This state belongs only to the new disclosures.
      let printState = null;
      window.addEventListener('beforeprint', () => {
        if (printState) return;
        printState = new Map();
        for (const details of summary.querySelectorAll('.manager-indicator-disclosure, .manager-indicator-evidence')) {
          printState.set(details, details.open);
          details.open = true;
        }
      });
      window.addEventListener('afterprint', () => {
        if (!printState) return;
        for (const [details, open] of printState) if (details.isConnected) details.open = open;
        printState = null;
      });
    }

    if (savedList) {
      const emptyMessageObserver = new MutationObserver(syncEmptyNavigationName);
      emptyMessageObserver.observe(savedList, { childList: true, subtree: true });
      syncEmptyNavigationName();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
