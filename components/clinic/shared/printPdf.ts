// Print a DOM node as a PDF via the browser's print-to-PDF. Clones the
// page's stylesheets into a print window so the document renders exactly
// like the on-screen card (including clinic-theme CSS variables set inline
// on <html> by ClinicContext). `blackAndWhite` layers a grayscale filter.
export const printElementAsPdf = (elementId: string, title: string, blackAndWhite: boolean) => {
  const printContent = document.getElementById(elementId);
  if (!printContent) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const stylesheetMarkup = Array.from(
    document.head.querySelectorAll('link[rel="stylesheet"], style')
  ).map(el => el.outerHTML).join('\n');
  const rootInlineStyle = (document.documentElement.getAttribute('style') || '')
    .replace(/"/g, '&quot;');
  const safeTitle = title.replace(/[<>]/g, '');
  const grayscaleCss = blackAndWhite
    ? '.pdf-doc, .pdf-doc * { filter: grayscale(100%) !important; }'
    : '';
  printWindow.document.write(`<!DOCTYPE html>
<html lang="en" style="${rootInlineStyle}">
<head>
<meta charset="UTF-8" />
<title>${safeTitle}</title>
${stylesheetMarkup}
<style>
  html, body { background: #ffffff !important; color: #0f172a; margin: 0; }
  body { padding: 24px; font-family: Inter, sans-serif; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .pdf-doc { max-width: 960px; margin: 0 auto; }
  .pdf-doc button { cursor: default; }
  @media print {
    @page { margin: 12mm; }
    body { padding: 0; }
  }
  ${grayscaleCss}
</style>
</head>
<body class="bg-white text-slate-900">
<div class="pdf-doc">${printContent.outerHTML}</div>
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.focus(); window.print(); }, 300);
  });
</script>
</body>
</html>`);
  printWindow.document.close();
};
