import { useEffect } from 'react';

/**
 * Stops the browser's autofill accessory bar (key / credit card / location
 * icons above the keyboard) from appearing on the portal's fields.
 *
 * Those suggestions are for sign-in, payment and address forms. The portal's
 * fields are animal names, weights, quantities and notes, so the bar is noise
 * that also eats a strip of the screen above the keyboard.
 *
 * Done once, here, rather than on every `<input>` in every view: a
 * MutationObserver tags each field as it is added (sheets and pages mount
 * fields constantly), which is early enough for the browser to see it before
 * the field is focused. A field that already states its own `autocomplete` is
 * left alone, so a deliberate `tel` or `email` hint still works.
 *
 * ⚠️ This is a request, not a switch. Chrome and Android honour
 * `autocomplete="off"`; iOS Safari honours it for most fields but may still
 * show its bar on a field it believes is an address or payment one. The
 * password-manager opt-outs (`data-1p-ignore`, `data-lpignore`) cover 1Password
 * and LastPass.
 */
const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea';

function tag(el: Element) {
  if (!el.hasAttribute('autocomplete')) el.setAttribute('autocomplete', 'off');
  if (!el.hasAttribute('data-1p-ignore')) el.setAttribute('data-1p-ignore', 'true');
  if (!el.hasAttribute('data-lpignore')) el.setAttribute('data-lpignore', 'true');
}

function tagWithin(node: Node) {
  if (!(node instanceof Element)) return;
  if (node.matches(FIELDS)) tag(node);
  node.querySelectorAll(FIELDS).forEach(tag);
}

export function useNoAutofill() {
  useEffect(() => {
    tagWithin(document.body);
    const observer = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach(tagWithin);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}
