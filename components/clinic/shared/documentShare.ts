// Real PDFs for clinic documents — invoices, receipts, certificates, reports.
//
// The old path (`printPdf.ts`) never made a PDF at all: it opened a window and
// called `window.print()`, so "Download PDF" was a print dialog. On a phone that
// is close to useless, and there is no file at the end of it to send anyone.
//
// Here we rasterise the on-screen document and lay it into a real A4 PDF, which
// gives us an actual `File`. That file is what makes sharing possible:
//   • phone   → `navigator.share({ files })` opens the native sheet, and picking
//               WhatsApp attaches the PDF itself.
//   • desktop → no browser reliably shares files, so we save the PDF and open
//               WhatsApp Web pre-addressed; the sender attaches what we saved.
//
// jspdf + html2canvas-pro are ~1 MB together and are ONLY needed when someone
// exports, so they are dynamically imported. Never import them at module top
// level — this file is pulled into the clinic bundle, which is already large.

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 10;

/** Kenyan-style local number → E.164 digits, matching the backend's `toE164`. */
export const toWhatsappDigits = (raw: string | null | undefined, defaultCc = '254'): string | null => {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d]/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = defaultCc + d.slice(1);
  else if (d.length <= 9) d = defaultCc + d;
  if (d.length < 8 || d.length > 15) return null;
  return d;
};

export const safeFileName = (title: string) =>
  `${(title || 'document').replace(/[^\w\d\-. ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'document'}.pdf`;

/**
 * Rasterise `elementId` and lay it into an A4 PDF.
 *
 * Two things have to be neutralised before capture or the document comes out
 * wrong, and both are easy to miss:
 *
 *  1. **Dark mode.** Tailwind's `dark:` variants key off `.dark` on <html>
 *     (`App.tsx:855`). A clone stays inside that root, so a clinic working in
 *     dark mode would export a black invoice. We strip the class for the
 *     duration of the capture and restore it in `finally` — including if the
 *     render throws, otherwise we would leave the app stuck in light mode.
 *  2. **Layout width.** The element may be inside a narrow modal. We clone it
 *     into an off-screen box at a fixed A4-ish pixel width so the PDF is laid
 *     out for paper rather than for whatever the screen happened to be.
 */
export const renderElementToPdfBlob = async (
  elementId: string,
  opts: { blackAndWhite?: boolean } = {},
): Promise<Blob | null> => {
  const source = document.getElementById(elementId);
  if (!source) return null;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  const root = document.documentElement;
  const wasDark = root.classList.contains('dark');

  // Off-screen, not `display:none` — a hidden subtree has no layout and
  // html2canvas would capture an empty box.
  const holder = document.createElement('div');
  holder.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:794px',            // A4 at 96dpi, so line breaks match the paper
    'background:#ffffff',
    'padding:24px',
    'z-index:-1',
    'color:#0f172a',
  ].join(';');

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');   // never two live nodes on one id

  // `print:hidden` is this app's existing convention for "chrome, not document"
  // — close buttons, action rows, modal furniture. It is a print-media rule, so
  // it does NOT apply to an off-screen clone, and without this the PDF comes out
  // with a "Print / Save PDF" button rendered inside it. Strip those nodes, plus
  // anything explicitly opted out with `data-nopdf`.
  clone.querySelectorAll('[class*="print:hidden"], [data-nopdf]').forEach((el) => el.remove());

  if (opts.blackAndWhite) clone.style.filter = 'grayscale(100%)';
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    if (wasDark) root.classList.remove('dark');

    const canvas = await html2canvas(holder, {
      scale: 2,                    // legible text without an enormous file
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: holder.scrollWidth,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const imgW = A4_W_MM - MARGIN_MM * 2;
    const imgH = (canvas.height * imgW) / canvas.width;
    const pageH = A4_H_MM - MARGIN_MM * 2;
    const data = canvas.toDataURL('image/jpeg', 0.92);

    pdf.addImage(data, 'JPEG', MARGIN_MM, MARGIN_MM, imgW, imgH, undefined, 'FAST');

    // Anything taller than one page is re-drawn shifted up, one page at a time.
    let remaining = imgH - pageH;
    while (remaining > 0) {
      pdf.addPage();
      pdf.addImage(data, 'JPEG', MARGIN_MM, MARGIN_MM - (imgH - remaining), imgW, imgH, undefined, 'FAST');
      remaining -= pageH;
    }

    return pdf.output('blob') as Blob;
  } finally {
    if (wasDark) root.classList.add('dark');
    holder.remove();
  }
};

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** Save the document as a real PDF file. No print dialog. */
export const downloadDocumentPdf = async (
  elementId: string,
  title: string,
  blackAndWhite = false,
): Promise<boolean> => {
  const blob = await renderElementToPdfBlob(elementId, { blackAndWhite });
  if (!blob) return false;
  saveBlob(blob, safeFileName(title));
  return true;
};

/**
 * Is this a handset?
 *
 * It decides whether `navigator.share` is worth using, and the naive check —
 * "does the browser support sharing files?" — gives the WRONG answer on a Mac.
 * Safari and Chrome on macOS *do* support it; they just open the system share
 * sheet, which lists AirDrop, Mail, Messages, Notes… and no WhatsApp, because
 * WhatsApp is not registered as a share extension. A button that says "Share on
 * WhatsApp" then visibly fails to offer WhatsApp.
 *
 * So we ask about the DEVICE instead. iPadOS reports itself as a Mac, hence the
 * touch-point check.
 */
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPod|Windows Phone|Mobile/i.test(ua)) return true;
  // iPad on iPadOS 13+ pretends to be macOS; real Macs report maxTouchPoints 0.
  if (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true;
  return false;
};

export const whatsappLink = (phone: string | null | undefined, text: string) => {
  const digits = toWhatsappDigits(phone);
  const q = `?text=${encodeURIComponent(text)}`;
  return digits ? `https://wa.me/${digits}${q}` : `https://wa.me/${q}`;
};

/**
 * Desktop link. `web.whatsapp.com/send` opens the chat directly; `wa.me` would
 * bounce through an interstitial first. With no number we cannot address a
 * chat, so fall back to `wa.me`, which at least offers a contact picker.
 */
export const whatsappWebLink = (phone: string | null | undefined, text: string) => {
  const digits = toWhatsappDigits(phone);
  return digits
    ? `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
};

export type ShareOutcome =
  | 'shared'      // went out through the native share sheet, PDF attached
  | 'fallback'    // PDF saved + WhatsApp opened; sender attaches it
  | 'cancelled'   // user dismissed the share sheet
  | 'failed';

/**
 * Share the document on WhatsApp.
 *
 * `navigator.share` with files is the good path and is what phones get. It must
 * be called in the same user gesture that produced it, so the PDF render has to
 * finish first — that is why this awaits the blob before touching `share`.
 *
 * Desktop browsers overwhelmingly cannot share files, so rather than pretend,
 * we save the PDF and open WhatsApp Web already addressed to the client. The
 * caller is expected to tell the user to attach the saved file — see
 * `DocumentActions`.
 */
export const shareDocumentOnWhatsapp = async (input: {
  elementId: string;
  title: string;
  message: string;
  phone?: string | null;
  blackAndWhite?: boolean;
}): Promise<ShareOutcome> => {
  const { elementId, title, message, phone, blackAndWhite } = input;
  let blob: Blob | null = null;
  try {
    blob = await renderElementToPdfBlob(elementId, { blackAndWhite });
  } catch {
    return 'failed';
  }
  if (!blob) return 'failed';

  const fileName = safeFileName(title);
  const file = new File([blob], fileName, { type: 'application/pdf' });

  // Handsets only — see `isMobileDevice`. On a desktop the system sheet has no
  // WhatsApp in it, so going through it would be a worse answer than the web
  // link, however capable the browser claims to be.
  const canShareFile =
    isMobileDevice() &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  if (canShareFile) {
    try {
      await navigator.share({ files: [file], title, text: message });
      return 'shared';
    } catch (err: any) {
      // AbortError is the user closing the sheet — not a failure worth a toast.
      if (err?.name === 'AbortError') return 'cancelled';
      // Anything else: fall through to the save + wa.me path rather than
      // leaving the user with nothing.
    }
  }

  // Desktop: save the PDF and open WhatsApp Web already addressed. WhatsApp
  // cannot be handed a file over a URL, so the sender attaches what we saved —
  // the caller's toast says so.
  saveBlob(blob, fileName);
  window.open(whatsappWebLink(phone, message), '_blank', 'noopener');
  return 'fallback';
};

/**
 * The pet-owner portal, on whatever host we are already running on — so a
 * staging clinic links clients to the staging portal, not to production.
 */
export const clientPortalUrl = () =>
  typeof window === 'undefined' ? '' : `${window.location.origin}/client`;

/**
 * Caption for the WhatsApp share.
 *
 * It carries the PDF *and* points at the portal, because the two do different
 * jobs: the attachment is what the client keeps in their chat, and the portal
 * is where they can pull the document down again in six months when that chat
 * is long buried. A client who has not signed up still gets the file.
 */
export const buildDocumentMessage = (opts: {
  /** Human label for the document, e.g. "invoice INV-0042". */
  docLabel: string;
  clientName?: string | null;
  clinicName?: string | null;
  /** Off for documents that are not the client's own (internal reports). */
  includePortalLink?: boolean;
}): string => {
  const first = (opts.clientName || '').trim().split(/\s+/)[0];
  const from = opts.clinicName ? ` from ${opts.clinicName}` : '';
  const hello = first ? `Hi ${first}, ` : '';
  const head = `${hello}here is your ${opts.docLabel}${from}.`;
  if (opts.includePortalLink === false) return head;
  const url = clientPortalUrl();
  return url
    ? `${head}\n\nYou can view and download it any time in your pet owner portal: ${url}`
    : head;
};
