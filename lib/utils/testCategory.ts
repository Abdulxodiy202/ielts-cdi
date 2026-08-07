// Full-vs-training test classifier. Listening has a section-training
// mode (10 questions / one part) whose tests share the `type='listening'`
// row but use order_number >= 1001 to signal "not a real full test."
// Reading has no training mode -- every reading row is a full test.
//
// Everything star-related (test_results insert, star badge, band chip,
// per-section counter, celebration toast) must gate on this. If it ever
// changes to a proper column, keep this the single source of truth so
// callers don't drift.
export function isFullTest(type: string | null | undefined, orderNumber: number | null | undefined): boolean {
  if (type === 'listening') {
    return typeof orderNumber === 'number' ? orderNumber < 1000 : true
  }
  // Reading and any other type: every row is a full test.
  return true
}
