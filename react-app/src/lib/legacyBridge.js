/**
 * Temporary adapter to communicate with legacy iframe.
 * This keeps migration incremental while preserving existing behavior.
 */
export function createLegacyBridge(frameRef) {
  function post(type, payload = {}) {
    const frame = frameRef?.current;
    if (!frame || !frame.contentWindow) return;

    frame.contentWindow.postMessage(
      {
        source: "she-store-react",
        type,
        payload
      },
      "*"
    );
  }

  return {
    setSearch(value) {
      post("set-search", { value });
    },
    setMode(mode) {
      post("set-mode", { mode });
    },
    setTab(tab) {
      post("set-tab", { tab });
    },
    setActiveOrderId(orderId) {
      post("set-active-order-id", { orderId });
    },
    exportCurrentPdf() {
      post("export-current-pdf");
    },
    openAddPurchaseModal() {
      post("open-add-purchase-modal");
    },
    dispose() {
      // no listeners yet; reserved for next migration steps
    }
  };
}
