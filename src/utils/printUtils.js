const PRINT_STYLE_ID = "__stn_print_style__";

const ensurePrintStyle = () => {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
@media print {
  @page { margin: 1cm; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #fff !important;
  }
  body * {
    overflow: visible !important;
    max-height: none !important;
  }
  body.stn-printing * {
    visibility: hidden !important;
  }
  body.stn-printing [data-print-target="true"],
  body.stn-printing [data-print-target="true"] * {
    visibility: visible !important;
  }
  body.stn-printing [data-print-target="true"] {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    right: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 16px !important;
    background: #fff !important;
    box-shadow: none !important;
    transform: none !important;
  }
  body.stn-printing [data-print-target="true"] .no-print,
  body.stn-printing .no-print {
    display: none !important;
    visibility: hidden !important;
  }
}
  `;
  document.head.appendChild(style);
};

export const printElement = (element) => {
  const target = typeof element === "string"
    ? document.querySelector(element)
    : element;

  if (!target) {
    console.error("[printElement] No target element found:", element);
    return;
  }

  ensurePrintStyle();

  target.setAttribute("data-print-target", "true");
  document.body.classList.add("stn-printing");

  void document.body.offsetHeight;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    target.removeAttribute("data-print-target");
    document.body.classList.remove("stn-printing");
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  setTimeout(cleanup, 60000);

  try {
    window.print();
  } catch (err) {
    console.error("[printElement] window.print() threw:", err);
    cleanup();
  }
};
