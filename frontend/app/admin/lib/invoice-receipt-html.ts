/**
 * Thermal / POS-style service invoice HTML matching the GeekSalon Figma receipt
 * (SALONBOS node 826:6682).
 */

export type ReceiptLineItem = {
  name: string
  unitPrice: number
  qty: number
  total: number
}

export type InvoiceReceiptInput = {
  brandName: string
  companyName?: string
  address?: string
  vatRegNo?: string
  outletLabel?: string
  cashier?: string
  terminalId?: string
  invoiceNo: string
  /** Display date/time, e.g. 12/07/2026   03:45 PM */
  dateTimeLabel: string
  lineItems: ReceiptLineItem[]
  /** Catalog subtotal before discount */
  subTotal: number
  discount: number
  taxRate: number
  /**
   * VAT amount charged on this invoice.
   * When omitted, derived so Sub − Discount + VAT = Total Amount (no rounding line).
   */
  vatAmount?: number
  /** Invoice bill total (services + packages + tax − discount + due collection) */
  totalAmount: number
  /** Prior due collected on this invoice (shown as its own line; not taxed) */
  dueCollected?: number
  /** Amount already paid (0 = unpaid, partial, or full) */
  cashReceived: number
  supportPhone?: string
  website?: string
  /** Payment status label shown on receipt */
  paymentStatus?: "Unpaid" | "Partial" | "Paid"
}

function esc(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function fmtNum(value: number, decimals = 0): string {
  const n = Number(value) || 0
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

function fmtMoney(value: number): string {
  const n = Number(value) || 0
  const decimals = Math.abs(n % 1) > 0.001 ? 2 : 0
  return fmtNum(n, decimals)
}

function allocateDiscount(items: ReceiptLineItem[], discount: number): { name: string; amount: number }[] {
  if (discount <= 0 || items.length === 0) return []
  const catalog = items.reduce((s, i) => s + i.total, 0)
  if (catalog <= 0) return []

  const rows: { name: string; amount: number }[] = []
  let allocated = 0
  items.forEach((item, idx) => {
    const isLast = idx === items.length - 1
    const share = isLast
      ? Math.max(0, Math.round((discount - allocated) * 100) / 100)
      : Math.round(((item.total / catalog) * discount) * 100) / 100
    allocated += share
    if (share > 0) rows.push({ name: item.name, amount: share })
  })
  return rows
}

export function buildInvoiceReceiptHtml(input: InvoiceReceiptInput): string {
  const brand = input.brandName.trim() || "Salon"
  const company = (input.companyName || brand).trim()
  const subTotal = Math.max(0, Number(input.subTotal) || 0)
  const discount = Math.max(0, Number(input.discount) || 0)
  const taxRate = Math.min(100, Math.max(0, Number(input.taxRate) || 0))
  const afterDiscount = Math.max(0, subTotal - discount)
  const dueCollected = Math.max(0, Number(input.dueCollected) || 0)
  const totalAmount = Math.max(
    0,
    Number(input.totalAmount ?? (input as { netPayable?: number }).netPayable) || 0,
  )
  // Balance to goods total (exclude due collection — it is not taxed)
  const goodsTotal = Math.max(0, totalAmount - dueCollected)
  const vatRaw =
    input.vatAmount != null && Number.isFinite(Number(input.vatAmount))
      ? Math.max(0, Number(input.vatAmount))
      : Math.max(0, goodsTotal - afterDiscount)
  const cashReceived = Math.max(0, Number(input.cashReceived) || 0)
  const netPayable = Math.max(0, totalAmount - cashReceived)
  const paymentStatus =
    input.paymentStatus ||
    (cashReceived <= 0
      ? "Unpaid"
      : cashReceived + 0.001 >= totalAmount
        ? "Paid"
        : "Partial")
  const discountRows = allocateDiscount(input.lineItems, discount)

  const lineRows = input.lineItems
    .map(
      (item, i) => `
        <div class="row line">
          <span class="sl">${i + 1}.</span>
          <span class="desc">${esc(item.name)}</span>
          <span class="price">${esc(fmtMoney(item.unitPrice))}</span>
          <span class="qty">${esc(item.qty)}</span>
          <span class="total">${esc(fmtMoney(item.total))}</span>
        </div>`,
    )
    .join("")

  const discountItemRows = discountRows
    .map(
      (row, i) => `
        <div class="kv">
          <span>${i + 1}. ${esc(row.name)}</span>
          <span>${esc(fmtMoney(row.amount))}</span>
        </div>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(input.invoiceNo)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: 80mm auto;
      margin: 4mm 3mm;
    }

    body {
      font-family: "Roboto Mono", "Courier New", Courier, monospace;
      font-size: 10px;
      line-height: 1.35;
      color: #666;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      width: 72mm;
      max-width: 280px;
      margin: 0 auto;
      padding: 10px 8px 16px;
    }

    .center { text-align: center; }
    .black { color: #000; }
    .dark { color: #333; }
    .medium { font-weight: 500; color: #000; }

    .brand {
      font-size: 28px;
      font-weight: 500;
      color: #333;
      text-align: center;
      line-height: 1.15;
      word-break: break-word;
    }

    .company {
      margin-top: 4px;
      font-size: 12px;
      text-align: center;
      color: #666;
    }

    .block { margin-top: 10px; }
    .dash {
      border: none;
      border-top: 1px dashed #666;
      margin: 10px 0;
    }

    .meta p { margin: 0 0 6px; font-size: 12px; color: #666; }
    .title {
      font-size: 12px;
      font-weight: 500;
      color: #000;
      text-align: center;
      margin-bottom: 12px;
      letter-spacing: 0.02em;
    }

    .loyalty {
      text-align: center;
      font-size: 12px;
      color: #666;
      padding: 2px 0 2px;
    }

    .head, .row.line {
      display: grid;
      grid-template-columns: 16px 1fr 42px 24px 42px;
      gap: 4px;
      align-items: start;
      width: 100%;
    }

    .head {
      font-size: 11px;
      color: #000;
      padding: 8px 0;
    }

    .row.line {
      font-size: 10px;
      color: #666;
      padding: 6px 0 2px;
    }

    .head .price, .head .qty, .head .total,
    .row .price, .row .qty, .row .total { text-align: right; }
    .row .desc { overflow-wrap: anywhere; }

    .kv {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 3px 0;
      font-size: 10px;
      color: #666;
    }

    .kv.strong {
      color: #000;
      font-weight: 500;
    }

    .kv.strong span:last-child { font-weight: 400; }

    .section-title {
      text-align: center;
      font-size: 10px;
      font-weight: 500;
      color: #000;
      padding: 4px 0;
    }

    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }

    .footer p { margin: 0 0 8px; }
    .footer .thanks {
      font-weight: 500;
      color: #000;
      margin: 10px 0;
    }
    .footer .sys {
      font-weight: 500;
      color: #000;
      font-size: 12px;
      margin-top: 10px;
    }
    .footer .sys-url {
      margin-top: 4px;
      font-size: 10px;
      color: #666;
    }

    @media print {
      body { width: 72mm; max-width: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="brand">${esc(brand)}</div>
  <div class="company">${esc(company)}</div>

  <hr class="dash" />

  ${input.address ? `<p class="block" style="font-size:12px">Address: ${esc(input.address)}</p>` : ""}
  ${(input.vatRegNo || input.outletLabel)
      ? `<div class="block" style="font-size:12px">
          ${input.vatRegNo ? `<p>BIN No: ${esc(input.vatRegNo)}</p>` : ""}
          ${input.outletLabel ? `<p>${esc(input.outletLabel)}</p>` : ""}
        </div>`
      : ""}

  <hr class="dash" />

  <div class="title">SERVICE INVOICE</div>
  <div class="meta">
    ${input.cashier ? `<p>Cashier: ${esc(input.cashier)}</p>` : ""}
    ${input.terminalId ? `<p>Terminal ID: ${esc(input.terminalId)}</p>` : ""}
    <p>Invoice No: ${esc(input.invoiceNo)}</p>
    <p>Date: ${esc(input.dateTimeLabel)}</p>
  </div>

  <hr class="dash" />

  <p class="loyalty">To enjoy special discounts, please<br/>register as a loyalty member.</p>

  <hr class="dash" />

  <div class="head">
    <span>SL</span>
    <span>Service Description</span>
    <span class="price">Price</span>
    <span class="qty">Qty</span>
    <span class="total">Total</span>
  </div>

  <hr class="dash" />

  <div class="lines">${lineRows || `<div class="center" style="padding:8px 0">No services</div>`}</div>

  <hr class="dash" />

  <div class="kv"><span>Sub Total:</span><span>${esc(fmtMoney(subTotal))}</span></div>
  <div class="kv"><span>(-)Discount:</span><span>${esc(fmtMoney(discount))}</span></div>

  <hr class="dash" />

  <div class="kv"><span></span><span>${esc(fmtMoney(afterDiscount))}</span></div>
  ${
    taxRate > 0 || vatRaw > 0
      ? `<div class="kv"><span>VAT(${esc(fmtNum(taxRate, taxRate % 1 ? 2 : 0))}%):</span><span>${esc(fmtMoney(vatRaw))}</span></div>`
      : ""
  }

  <hr class="dash" />

  ${
    dueCollected > 0
      ? `<div class="kv"><span>Due Collection:</span><span>${esc(fmtMoney(dueCollected))}</span></div>
  <hr class="dash" />`
      : ""
  }

  <div class="kv strong"><span>Total Amount:</span><span>${esc(fmtMoney(totalAmount))}</span></div>
  <div class="kv"><span>Cash Received:</span><span>${esc(fmtMoney(cashReceived))}</span></div>
  <div class="kv strong"><span>Net Payable:</span><span>${esc(fmtMoney(netPayable))}</span></div>
  <div class="kv"><span>Status:</span><span>${esc(paymentStatus)}</span></div>

  <hr class="dash" />

  <div class="section-title">DISCOUNT ITEMS</div>
  <hr class="dash" />
  ${
    discountItemRows
      ? `<div>${discountItemRows}</div>`
      : `<div class="kv"><span>No discount items</span><span>0</span></div>`
  }

  <hr class="dash" />

  <div class="kv strong">
    <span>Your total savings today Tk.</span>
    <span>${esc(fmtMoney(discount))}</span>
  </div>

  <hr class="dash" />

  <div class="footer">
    <p>**VAT against this invoice is payable<br/>through central registration**</p>
    <p>Thank you for visiting ${esc(brand)}</p>
    ${
      input.website
        ? `<p>Please visit ${esc(input.website)} to book your<br/>next appointment online.</p>`
        : ""
    }
    ${
      input.supportPhone
        ? `<p>Any queries or complaints, please call<br/>${esc(input.supportPhone)}</p>`
        : ""
    }
    <p class="sys">System by Geekssort</p>
    <p class="sys-url">www.geekssort.com</p>
  </div>
</body>
</html>`
}

/**
 * Resolve the tax % for an existing invoice without using live settings.
 * Order: frozen snapshot → infer from catalog vs invoice total → 0.
 */
export function resolveInvoiceTaxRate(input: {
  snapshottedRate?: number | null
  catalogSubtotal: number
  totalAmount: number
  discount?: number
}): number {
  if (input.snapshottedRate != null && Number.isFinite(Number(input.snapshottedRate))) {
    return Math.min(100, Math.max(0, Number(input.snapshottedRate)))
  }
  const sub = Math.max(0, Number(input.catalogSubtotal) || 0)
  const discount = Math.min(sub, Math.max(0, Number(input.discount) || 0))
  const after = Math.max(0, sub - discount)
  const total = Math.max(0, Number(input.totalAmount) || 0)
  if (after > 0 && total > after + 0.009) {
    const tax = total - after
    return Math.min(100, Math.max(0, Math.round((tax / after) * 1000) / 10))
  }
  return 0
}

/**
 * Build Sub Total / Discount / VAT from the printed line items.
 * Sub Total = sum of line prices, using TODAY's catalog prices as the best available
 * estimate for the per-line breakdown (invoices don't store a price-per-line snapshot).
 * VAT = ceil((Sub − Discount) × rate%) to match booking confirm totals.
 *
 * The printed Total ALWAYS reconciles to the invoice's actual stored total (the money
 * that was really charged) — never to a total recomputed from current catalog prices.
 * If a catalog price changed after the invoice was created, the catalog-derived subtotal
 * would silently drift from what was actually charged; reconciling VAT as the residual
 * keeps the receipt's bottom line accurate even though the line-item breakdown is only
 * an approximation for older invoices.
 */
export function resolveReceiptFinancials(input: {
  catalogSubtotal: number
  totalAmount: number
  taxRate: number
  discount?: number
  /** Prior due on the invoice — excluded from VAT reconciliation */
  dueCollected?: number
}): {
  subTotal: number
  discount: number
  vatAmount: number
  taxRate: number
  /** Receipt total: always the invoice's real, stored total amount. */
  totalAmount: number
  dueCollected: number
} {
  const invoiceTotal = Math.max(0, Number(input.totalAmount) || 0)
  const dueCollected = Math.max(0, Number(input.dueCollected) || 0)
  const goodsTotal = Math.max(0, invoiceTotal - dueCollected)
  const rate = Math.min(100, Math.max(0, Number(input.taxRate) || 0))
  const catalog = Math.max(0, Number(input.catalogSubtotal) || 0)
  const storedDiscount = Math.max(0, Number(input.discount) || 0)

  // Prefer the sum of priced line items shown on the receipt
  if (catalog > 0) {
    const subTotal = Math.round(catalog * 100) / 100
    const discount = Math.min(storedDiscount, subTotal)
    const afterDiscount = Math.max(0, Math.round((subTotal - discount) * 100) / 100)
    const forwardVat = rate > 0 ? Math.ceil((afterDiscount * rate) / 100) : 0
    const forwardGoods = Math.round((afterDiscount + forwardVat) * 100) / 100

    // Reconcile VAT to goods portion only (due collection is untaxed)
    let vatAmount = forwardVat
    if (goodsTotal > 0 && Math.abs(goodsTotal - forwardGoods) > 0.5) {
      vatAmount = Math.max(0, Math.round((goodsTotal - afterDiscount) * 100) / 100)
    }

    return {
      subTotal,
      discount,
      vatAmount,
      taxRate: rate,
      totalAmount: invoiceTotal,
      dueCollected,
    }
  }

  // No catalog prices — fall back to tax-inclusive goods total
  if (rate > 0 && goodsTotal > 0) {
    const vatAmount = Math.round(((goodsTotal * rate) / (100 + rate)) * 100) / 100
    const netOfVat = Math.max(0, Math.round((goodsTotal - vatAmount) * 100) / 100)
    return {
      subTotal: Math.round((netOfVat + storedDiscount) * 100) / 100,
      discount: storedDiscount,
      vatAmount,
      taxRate: rate,
      totalAmount: invoiceTotal,
      dueCollected,
    }
  }

  return {
    subTotal: goodsTotal,
    discount: 0,
    vatAmount: 0,
    taxRate: rate,
    totalAmount: invoiceTotal,
    dueCollected,
  }
}

function normalizeReceiptName(name: string) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/** Look up a unit price with trimmed / case-insensitive matching. */
export function lookupCatalogUnitPrice(
  priceMap: Map<string, number>,
  name: string,
): number {
  const direct = priceMap.get(name)
  if (direct != null && Number.isFinite(direct)) return Number(direct) || 0
  const key = normalizeReceiptName(name)
  if (!key) return 0
  for (const [n, price] of priceMap.entries()) {
    if (normalizeReceiptName(n) === key) return Number(price) || 0
  }
  return 0
}

/** Prefer large receipt brand “Elegant” with legal company line below. */
export const RECEIPT_BRAND_NAME = "Elegant"
export const RECEIPT_COMPANY_NAME = "House of Elegance Ltd"

/** Large hero brand on thermal receipts. */
export function receiptBrandFromBusinessName(_businessName?: string | null): string {
  return RECEIPT_BRAND_NAME
}

/** Company line under the brand — fixed legal name with correct spelling. */
export function receiptCompanyFromBusinessName(_businessName?: string | null): string {
  return RECEIPT_COMPANY_NAME
}

export function formatReceiptDateTime(dateLike: string | Date | undefined | null): string {
  const d = dateLike ? new Date(dateLike) : new Date()
  if (Number.isNaN(d.getTime())) {
    return String(dateLike ?? "")
  }
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12 || 12
  const hh = String(hours).padStart(2, "0")
  return `${dd}/${mm}/${yyyy}   ${hh}:${minutes} ${ampm}`
}
