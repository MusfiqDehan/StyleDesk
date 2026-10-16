/**
 * Thermal / POS-style voucher receipt — same visual system as invoice receipts,
 * with voucher-specific identity (PAYMENT VOUCHER, voucher no, income/expense).
 */

export type VoucherReceiptInput = {
  brandName: string
  companyName?: string
  address?: string
  vatRegNo?: string
  voucherNo: string
  dateTimeLabel: string
  title: string
  description?: string
  type: "Income" | "Expense"
  amount: number
  category?: string
  supportPhone?: string
  website?: string
}

function esc(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function fmtMoney(value: number): string {
  const n = Number(value) || 0
  const decimals = Math.abs(n % 1) > 0.001 ? 2 : 0
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export function buildVoucherReceiptHtml(input: VoucherReceiptInput): string {
  const brand = input.brandName.trim() || "Salon"
  const company = (input.companyName || brand).trim()
  const amount = Math.max(0, Number(input.amount) || 0)
  const isExpense = input.type === "Expense"
  const typeLabel = isExpense ? "Expense" : "Income"
  const signedAmount = `${isExpense ? "-" : "+"}${fmtMoney(amount)}`
  const docTitle = isExpense ? "EXPENSE VOUCHER" : "INCOME VOUCHER"
  const description =
    (input.description || "").trim() &&
    (input.description || "").trim() !== (input.title || "").trim()
      ? (input.description || "").trim()
      : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Voucher ${esc(input.voucherNo)}</title>
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
      margin-bottom: 8px;
      letter-spacing: 0.04em;
    }
    .badge {
      display: inline-block;
      margin: 0 auto 10px;
      padding: 3px 10px;
      border: 1px solid ${isExpense ? "#e11d48" : "#27b85e"};
      color: ${isExpense ? "#e11d48" : "#27b85e"};
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.06em;
    }
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
    .amount-box {
      text-align: center;
      padding: 10px 0 4px;
    }
    .amount-box .label {
      font-size: 10px;
      color: #666;
      margin-bottom: 4px;
    }
    .amount-box .value {
      font-size: 18px;
      font-weight: 500;
      color: ${isExpense ? "#e11d48" : "#27b85e"};
    }
    .desc {
      font-size: 10px;
      color: #666;
      padding: 4px 0;
      overflow-wrap: anywhere;
    }
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    .footer p { margin: 0 0 8px; }
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
  ${
    input.vatRegNo
      ? `<div class="block" style="font-size:12px"><p>GST / BIN No: ${esc(input.vatRegNo)}</p></div>`
      : ""
  }

  <hr class="dash" />

  <div class="title">${esc(docTitle)}</div>
  <div class="center"><span class="badge">${esc(typeLabel.toUpperCase())}</span></div>

  <div class="meta">
    <p>Voucher No: ${esc(input.voucherNo)}</p>
    <p>Date: ${esc(input.dateTimeLabel)}</p>
    ${input.category ? `<p>Category: ${esc(input.category)}</p>` : ""}
  </div>

  <hr class="dash" />

  <div class="kv strong"><span>Particulars:</span><span></span></div>
  <p class="desc black" style="color:#000;font-weight:500">${esc(input.title)}</p>
  ${description ? `<p class="desc">${esc(description)}</p>` : ""}

  <hr class="dash" />

  <div class="amount-box">
    <div class="label">Amount</div>
    <div class="value">Tk. ${esc(signedAmount)}</div>
  </div>

  <hr class="dash" />

  <div class="kv strong"><span>Type:</span><span>${esc(typeLabel)}</span></div>
  <div class="kv strong"><span>Total:</span><span>Tk. ${esc(fmtMoney(amount))}</span></div>

  <hr class="dash" />

  <div class="footer">
    <p>This is an official payment voucher<br/>for salon finance records.</p>
    <p>Thank you — ${esc(brand)}</p>
    ${
      input.supportPhone
        ? `<p>Any queries, please call<br/>${esc(input.supportPhone)}</p>`
        : ""
    }
    <p class="sys">System by Geekssort</p>
    <p class="sys-url">www.geekssort.com</p>
  </div>
</body>
</html>`
}

export {
  formatReceiptDateTime,
  receiptBrandFromBusinessName,
  receiptCompanyFromBusinessName,
} from "./invoice-receipt-html"
