'use strict';

/* Local presentation layout only. Existing live nodes are moved, never copied
   or replaced: form handlers, input state, replies and conversation saving stay
   owned by the original application. No requests or storage operations occur. */
(() => {
  function init() {
    const page = document.getElementById('workspace-ask');
    const section = page?.querySelector('.chat-section');
    const workspace = section?.querySelector('.chat-workspace');
    const conversation = workspace?.querySelector('.conversation');
    const form = document.getElementById('chat-form');
    const messages = document.getElementById('messages');
    const evidence = document.getElementById('evidence-panel');
    const context = document.getElementById('chat-context');
    if (!section || !workspace || !conversation || !form || !messages || !evidence) return;
    if (document.getElementById('manager-ai-tools')) return;

    const tools = document.createElement('div');
    tools.id = 'manager-ai-tools';
    tools.className = 'manager-ai-tools';
    tools.setAttribute('role', 'region');
    tools.setAttribute('aria-label', '근거와 자료 도구');

    const scope = document.createElement('div');
    scope.className = 'manager-ai-scope';
    scope.setAttribute('role', 'group');
    scope.setAttribute('aria-label', '질문 범위');

    section.classList.add('manager-ai-layout');
    workspace.classList.add('manager-ai-columns');
    conversation.classList.add('manager-ai-conversation');
    workspace.append(tools);

    const rightOrder = [
      '#evidence-panel',
      '.question-examples',
      '#upload-details',
      '.visual-atlas',
      '.policy-studio',
      '.guide-description'
    ];

    function priority(element) {
      const index = rightOrder.findIndex(selector => element.matches(selector));
      return index === -1 ? rightOrder.length : index;
    }

    function alignNodes(parent, nodes) {
      let cursor = parent.firstChild;
      for (const node of nodes) {
        if (node === cursor) {
          cursor = cursor.nextSibling;
        } else {
          parent.insertBefore(node, cursor);
        }
      }
    }

    function toTools(element) {
      if (element.parentNode !== tools) tools.append(element);
    }

    function arrange() {
      const focused = document.activeElement;
      const hadFocus = section.contains(focused);

      // Scope controls belong beside the composer. Keep their original labels,
      // select elements, option values and change listeners as the same nodes.
      for (const control of section.querySelectorAll(':scope > .chat-scope-label')) {
        scope.append(control);
      }

      const saveControls = [...conversation.children].filter(element => element.matches('.chat-save-bar'));
      const core = [scope, context, form, messages, ...saveControls].filter(Boolean);
      const coreSet = new Set(core);

      // Move only stand-alone tools. Never inspect or rearrange anything inside
      // #messages: answer text, follow-ups and response-bound controls stay intact.
      for (const element of [...conversation.children]) {
        if (!coreSet.has(element) && !element.matches('script, style, template')) toTools(element);
      }

      for (const element of [...section.children]) {
        if (element === workspace || element === context || element === form || element === messages) continue;
        if (element.matches('.step, #chat-title, script, style, template')) continue;
        toTools(element);
      }

      for (const element of [...workspace.children]) {
        if (element === conversation || element === tools || element.matches('script, style, template')) continue;
        toTools(element);
      }

      alignNodes(conversation, core);
      if (evidence.parentNode !== tools) tools.prepend(evidence);
      const orderedTools = [...tools.children].sort((first, second) => priority(first) - priority(second));
      alignNodes(tools, orderedTools);

      // An already-focused live control can survive a late tool insertion.
      // Restore focus only when moving that same node caused a browser blur.
      if (hadFocus && focused.isConnected && document.activeElement !== focused && !page.hidden) {
        focused.focus({ preventScroll: true });
      }
    }

    arrange();

    // Original synchronous modules are ready at DOMContentLoaded. Watch only
    // their outer insertion points in case a stand-alone tool is added later;
    // response text, attachment internals and saved conversations are not watched.
    const observer = new MutationObserver(arrange);
    observer.observe(section, { childList: true });
    observer.observe(workspace, { childList: true });
    observer.observe(conversation, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
