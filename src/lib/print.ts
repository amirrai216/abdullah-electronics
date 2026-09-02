import type { Sale, Settings, Payment } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/format';

/**
 * Export an array of rows to CSV and trigger download.
 */
export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) {
    alert('No data to export.');
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
  downloadBlob(filename, csv, 'text/csv;charset=utf-8;');
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const PRINT_FRAME_ID = '__ae_print_frame__';

/**
 * Write HTML into a hidden iframe and trigger the browser's native print
 * dialog on the current page. No new tabs or popups are opened, so pop-up
 * blockers never interfere.
 */
function printHTML(html: string) {
  let frame = document.getElementById(PRINT_FRAME_ID) as HTMLIFrameElement | null;

  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = PRINT_FRAME_ID;
    frame.style.position = 'fixed';
    frame.style.left = '-9999px';
    frame.style.top = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = 'none';
    document.body.appendChild(frame);
  }

  const doc = frame.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  const win = frame.contentWindow;
  if (!win) return;

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      // If printing fails (rare), silently ignore — the iframe remains
      // available for a retry on the next print request.
    }
  };

  // Give the iframe content a tick to lay out before invoking print.
  if ((win as any).onload) {
    triggerPrint();
  } else {
    frame.onload = triggerPrint;
    // Fallback in case onload already fired or doesn't fire.
    setTimeout(triggerPrint, 350);
  }
}

/**
 * Print an A4 invoice bill styled for Abdullah Electronics.
 * Includes installment details with manually-entered monthly amount and next due date.
 */
export function printInvoiceA4(sale: Sale, settings: Settings) {
  const items = sale.sale_items ?? [];
  const customer = sale.customer;
  const isInstallment = sale.sale_type === 'installment';

  const plan = sale.installment_plan;
  const durationMonths = plan?.duration_months ?? 0;
  const planAmount = plan?.installment_amount ?? 0;
  const monthlyAmount = planAmount > 0
    ? planAmount
    : durationMonths > 0
      ? sale.remaining_balance / durationMonths
      : 0;
  const nextDueDate = plan?.start_date ?? '';

  const statusBadge = isInstallment
    ? `<span class="badge badge-amber">INSTALLMENT</span>`
    : sale.remaining_balance > 0
      ? `<span class="badge badge-red">UNPAID</span>`
      : `<span class="badge badge-green">PAID</span>`;

  const html = `
<!doctype html><html><head><meta charset="utf-8"><title>${sale.invoice_no}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Inter', Arial, sans-serif; margin: 0; padding: 18px 24px; color: #1e293b; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .invoice-wrap { max-width: 800px; margin: 0 auto; }

  /* ---------- HEADER ---------- */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 3px solid #0f766e; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-mark { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #0f766e, #14b8a6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 800; }
  .brand-text h1 { font-size: 22px; font-weight: 800; color: #0f766e; line-height: 1.1; }
  .brand-text .tagline { font-size: 10px; color: #64748b; margin-top: 2px; font-weight: 500; text-transform: uppercase; }
  .contact-info { text-align: right; font-size: 11px; color: #475569; line-height: 1.5; }
  .contact-info .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; }
  .contact-info .val { font-weight: 600; color: #334155; }

  /* ---------- TITLE BAR ---------- */
  .title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .title-bar h2 { font-size: 16px; font-weight: 800; color: #0f172a; }
  .title-bar .doc-type { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-red { background: #fee2e2; color: #991b1b; }

  /* ---------- INVOICE META ---------- */
  .meta-strip { display: flex; margin-bottom: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
  .meta-cell { flex: 1; padding: 8px 14px; border-right: 1px solid #e2e8f0; }
  .meta-cell:last-child { border-right: none; }
  .meta-cell .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; margin-bottom: 2px; }
  .meta-cell .value { font-size: 12px; font-weight: 700; color: #1e293b; }

  /* ---------- PARTY CARDS ---------- */
  .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .party-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
  .party-card h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #0f766e; font-weight: 700; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  .party-card .field { margin-bottom: 3px; font-size: 11px; line-height: 1.4; }
  .party-card .field .fl { color: #64748b; font-weight: 500; min-width: 55px; display: inline-block; }
  .party-card .field .fv { color: #1e293b; font-weight: 600; }
  .party-card .field.name .fv { font-size: 13px; font-weight: 800; }

  /* ---------- ITEMS TABLE ---------- */
  .items-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .items-table thead th { background: #0f766e; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .items-table thead th.num { text-align: right; }
  .items-table thead th.center { text-align: center; }
  .items-table tbody td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; vertical-align: top; line-height: 1.3; }
  .items-table tbody tr:nth-child(even) td { background: #f8fafc; }
  .items-table tbody tr:last-child td { border-bottom: 2px solid #e2e8f0; }
  .items-table td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .items-table td.center { text-align: center; }
  .items-table .item-name { font-weight: 700; color: #1e293b; }
  .items-table .item-model { font-size: 10px; color: #64748b; font-weight: 500; }
  .items-table .row-num { color: #94a3b8; font-weight: 600; }

  /* ---------- TOTALS ---------- */
  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 10px; }
  .totals-box { min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; }
  .totals-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 12px; }
  .totals-row .label { color: #475569; font-weight: 500; }
  .totals-row .value { color: #1e293b; font-weight: 700; font-variant-numeric: tabular-nums; }
  .totals-row.discount .label, .totals-row.discount .value { color: #b91c1c; }
  .totals-divider { border: none; border-top: 1px solid #e2e8f0; margin: 4px 0; }
  .totals-row.grand .label { font-size: 14px; font-weight: 800; color: #0f172a; }
  .totals-row.grand .value { font-size: 18px; font-weight: 800; color: #0f766e; }
  .totals-row.balance .label { color: #b91c1c; font-weight: 600; }
  .totals-row.balance .value { color: #b91c1c; font-weight: 800; }

  /* ---------- INSTALLMENT BOX ---------- */
  .installment-box { background: #fffbeb; border: 1px solid #fcd34d; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 8px 14px; margin-bottom: 10px; }
  .installment-box h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #92400e; font-weight: 700; margin-bottom: 4px; }
  .installment-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
  .installment-row .label { color: #78350f; font-weight: 500; }
  .installment-row .value { color: #1e293b; font-weight: 700; }

  /* ---------- SIGNATURES ---------- */
  .sign-section { display: flex; justify-content: space-between; margin-top: 24px; padding: 0 20px; }
  .sign-block { text-align: center; width: 200px; }
  .sign-line { border-top: 1px solid #475569; padding-top: 4px; font-size: 11px; font-weight: 600; color: #475569; }

  /* ---------- FOOTER ---------- */
  .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; }
  .footer-note { font-size: 10px; color: #64748b; font-weight: 500; line-height: 1.4; }
  .footer-note .sep { margin: 0 6px; color: #cbd5e1; }
  .footer-thanks { font-size: 11px; font-weight: 700; color: #0f766e; margin-bottom: 2px; }

  /* ---------- PRINT OPTIMIZATION ---------- */
  @page { size: A4; margin: 10mm 12mm; }
  @media print {
    html, body { padding: 0; margin: 0; font-size: 10px; }
    .invoice-wrap { max-width: 100%; }
    .no-print { display: none !important; }
    .header { padding-bottom: 6px; margin-bottom: 8px; }
    .brand-mark { width: 32px; height: 32px; font-size: 14px; }
    .brand-text h1 { font-size: 18px; }
    .title-bar { margin-bottom: 6px; }
    .meta-strip { margin-bottom: 6px; }
    .meta-cell { padding: 5px 10px; }
    .party-grid { gap: 8px; margin-bottom: 8px; }
    .party-card { padding: 6px 10px; }
    .items-table { margin-bottom: 8px; }
    .items-table thead th { padding: 5px 8px; font-size: 9px; }
    .items-table tbody td { padding: 4px 8px; font-size: 10px; line-height: 1.2; }
    .totals-box { padding: 6px 12px; min-width: 260px; }
    .totals-row { padding: 2px 0; font-size: 11px; }
    .totals-row.grand .label { font-size: 12px; }
    .totals-row.grand .value { font-size: 15px; }
    .installment-box { padding: 6px 10px; margin-bottom: 6px; }
    .sign-section { margin-top: 14px; }
    .footer { margin-top: 8px; padding-top: 6px; }
  }
</style></head><body>
<div class="invoice-wrap">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <div class="brand-mark">AE</div>
      <div class="brand-text">
        <h1>Abdullah Electronics</h1>
        <div class="tagline">${settings.shop_name || 'Electronics &amp; Home Appliances'}</div>
      </div>
    </div>
    <div class="contact-info">
      <div class="label">Contact</div>
      <div class="val">${settings.shop_phone || '-'}</div>
      <div class="label" style="margin-top:4px">Address</div>
      <div class="val">${settings.shop_address || '-'}</div>
    </div>
  </div>

  <!-- TITLE BAR -->
  <div class="title-bar">
    <div>
      <h2>${isInstallment ? 'Installment Invoice' : 'Tax Invoice'}</h2>
      <div class="doc-type">${isInstallment ? 'Installment Sale' : 'Cash Sale'} Document</div>
    </div>
    <div>${statusBadge}</div>
  </div>

  <!-- META STRIP -->
  <div class="meta-strip">
    <div class="meta-cell">
      <div class="label">Invoice No.</div>
      <div class="value">${sale.invoice_no}</div>
    </div>
    <div class="meta-cell">
      <div class="label">Date</div>
      <div class="value">${formatDateTime(sale.sale_date)}</div>
    </div>
    <div class="meta-cell">
      <div class="label">Payment Status</div>
      <div class="value">${isInstallment ? 'Installment' : sale.remaining_balance > 0 ? 'Unpaid' : 'Paid'}</div>
    </div>
  </div>

  <!-- PARTY CARDS -->
  <div class="party-grid">
    <div class="party-card">
      <h3>Customer Details</h3>
      <div class="field name"><span class="fv">${customer?.full_name ?? 'Walk-in Customer'}</span></div>
      ${customer?.mobile ? `<div class="field"><span class="fl">Mobile</span><span class="fv">${customer.mobile}</span></div>` : ''}
      ${customer?.cnic ? `<div class="field"><span class="fl">CNIC</span><span class="fv">${customer.cnic}</span></div>` : ''}
      ${customer?.address ? `<div class="field"><span class="fl">Address</span><span class="fv">${customer.address}</span></div>` : ''}
    </div>
    <div class="party-card">
      <h3>Guarantor Details</h3>
      ${customer?.guarantor_name
        ? `<div class="field name"><span class="fv">${customer.guarantor_name}</span></div>
           ${customer?.guarantor_cnic ? `<div class="field"><span class="fl">CNIC</span><span class="fv">${customer.guarantor_cnic}</span></div>` : ''}
           ${customer?.guarantor_phone ? `<div class="field"><span class="fl">Phone</span><span class="fv">${customer.guarantor_phone}</span></div>` : ''}`
        : `<div class="field"><span class="fl" style="color:#94a3b8">No guarantor on record</span></div>`}
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Item Name &amp; Model</th>
        <th class="center" style="width:50px">Qty</th>
        <th class="num" style="width:90px">Unit Rate</th>
        <th class="num" style="width:100px">Line Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it, i) => `
        <tr>
          <td class="row-num">${i + 1}</td>
          <td>
            <div class="item-name">${it.product?.name ?? ''}</div>
            ${it.product?.brand_model ? `<div class="item-model">${it.product.brand_model}</div>` : ''}
          </td>
          <td class="center">${it.quantity}</td>
          <td class="num">${formatCurrency(it.unit_price, settings.currency)}</td>
          <td class="num">${formatCurrency(it.subtotal, settings.currency)}</td>
        </tr>`).join('')}
    </tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals-section">
    <div class="totals-box">
      <div class="totals-row"><span class="label">Subtotal</span><span class="value">${formatCurrency(sale.subtotal, settings.currency)}</span></div>
      ${sale.discount > 0 ? `<div class="totals-row discount"><span class="label">Discount Applied</span><span class="value">- ${formatCurrency(sale.discount, settings.currency)}</span></div>` : ''}
      <hr class="totals-divider" />
      <div class="totals-row grand"><span class="label">Grand Total</span><span class="value">${formatCurrency(sale.total, settings.currency)}</span></div>
      <hr class="totals-divider" />
      <div class="totals-row"><span class="label">Paid Amount</span><span class="value">${formatCurrency(sale.advance_paid, settings.currency)}</span></div>
      ${isInstallment || sale.remaining_balance > 0
        ? `<div class="totals-row balance"><span class="label">Remaining Balance</span><span class="value">${formatCurrency(sale.remaining_balance, settings.currency)}</span></div>`
        : ''}
    </div>
  </div>

  <!-- INSTALLMENT PLAN -->
  ${isInstallment ? `
  <div class="installment-box">
    <h4>Installment Plan Details</h4>
    <div class="installment-row"><span class="label">Monthly Installment Amount</span><span class="value">${formatCurrency(monthlyAmount, settings.currency)}</span></div>
    ${nextDueDate ? `<div class="installment-row"><span class="label">Next Due Date</span><span class="value">${nextDueDate}</span></div>` : ''}
    ${sale.payment_terms ? `<div class="installment-row"><span class="label">Terms</span><span class="value">${sale.payment_terms}</span></div>` : ''}
  </div>
  ` : ''}

  <!-- SIGNATURES -->
  <div class="sign-section">
    <div class="sign-block">
      <div class="sign-line">Customer Signature</div>
    </div>
    <div class="sign-block">
      <div class="sign-line">Authorized Signature</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-thanks">Thank you for your business!</div>
    <div class="footer-note">
      Goods once sold can only be claimed as per company warranty policies.
      <span class="sep">|</span>
      ${settings.invoice_footer || 'Abdullah Electronics - Quality you can trust.'}
    </div>
  </div>

</div>
</body></html>`;

  printHTML(html);
}

/**
 * Print an 80mm thermal receipt.
 */
export function printReceipt80mm(sale: Sale, settings: Settings) {
  const items = sale.sale_items ?? [];
  const customer = sale.customer;
  const isInstallment = sale.sale_type === 'installment';
  const plan = sale.installment_plan;
  const durationMonths = plan?.duration_months ?? 0;
  const planAmount = plan?.installment_amount ?? 0;
  const monthlyAmount = planAmount > 0
    ? planAmount
    : durationMonths > 0
      ? sale.remaining_balance / durationMonths
      : 0;
  const nextDueDate = plan?.start_date ?? '';

  const html = `
<!doctype html><html><head><meta charset="utf-8"><title>${sale.invoice_no}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; color:#000; font-size:11px; }
  .center { text-align:center; }
  .shop { font-size:15px; font-weight:bold; }
  .shop-sub { font-size:10px; }
  .divider { border-top:1px dashed #000; margin:6px 0; }
  .row { display:flex; justify-content:space-between; }
  .item { margin:3px 0; }
  .item-name { font-weight:bold; }
  .bold { font-weight:bold; }
  .totals { margin-top:6px; }
  .totals .row { margin:2px 0; }
  .grand { border-top:1px solid #000; margin-top:4px; padding-top:4px; font-weight:bold; font-size:13px; }
  .paid { font-weight:bold; color:#166534; }
  .footer { margin-top:8px; text-align:center; font-size:9px; }
  @media print { body { width:auto; } }
</style></head><body>
<div class="center">
  <div class="shop">${settings.shop_name}</div>
  <div class="shop-sub">${settings.shop_address || ''}</div>
  <div class="shop-sub">${settings.shop_phone || ''}</div>
</div>
<div class="divider"></div>
<div class="center bold">${isInstallment ? 'INSTALLMENT RECEIPT' : 'CASH RECEIPT'}</div>
<div class="row"><span>Inv:</span><span>${sale.invoice_no}</span></div>
<div class="row"><span>Date:</span><span>${formatDateTime(sale.sale_date)}</span></div>
<div class="divider"></div>
<div class="bold">Customer:</div>
<div>${customer?.full_name ?? 'Walk-in'}</div>
${customer?.mobile ? `<div>${customer.mobile}</div>` : ''}
${customer?.cnic ? `<div>CNIC: ${customer.cnic}</div>` : ''}
<div class="divider"></div>
${items.map((it) => `
<div class="item">
  <div class="item-name">${it.product?.name ?? ''} ${it.product?.brand_model ?? ''}</div>
  <div class="row"><span>${it.quantity} x ${formatCurrency(it.unit_price, settings.currency)}</span><span>${formatCurrency(it.subtotal, settings.currency)}</span></div>
</div>`).join('')}
<div class="divider"></div>
<div class="totals">
  <div class="row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal, settings.currency)}</span></div>
  ${sale.discount > 0 ? `<div class="row" style="color:#b91c1c"><span>Discount</span><span>- ${formatCurrency(sale.discount, settings.currency)}</span></div>` : ''}
  <div class="row grand"><span>Net Total</span><span>${formatCurrency(sale.total, settings.currency)}</span></div>
  ${isInstallment ? `
    <div class="row"><span>Advance</span><span>${formatCurrency(sale.advance_paid, settings.currency)}</span></div>
    <div class="row"><span>Balance</span><span>${formatCurrency(sale.remaining_balance, settings.currency)}</span></div>
    <div class="row"><span>Monthly Qist</span><span>${formatCurrency(monthlyAmount, settings.currency)}</span></div>
    ${nextDueDate ? `<div class="row"><span>Next Due</span><span>${nextDueDate}</span></div>` : ''}
  ` : `
    <div class="row paid"><span>PAID FULL</span><span>${formatCurrency(sale.advance_paid, settings.currency)}</span></div>
  `}
</div>
<div class="footer">${settings.invoice_footer || ''}<br>Thank you!</div>
</body></html>`;

  printHTML(html);
}

/**
 * Print a payment receipt for an installment payment.
 */
export function printPaymentReceipt(payment: Payment, sale: Sale | null, settings: Settings) {
  const customer = sale?.customer;
  const html = `
<!doctype html><html><head><meta charset="utf-8"><title>${payment.receipt_no ?? 'Receipt'}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; color:#000; font-size:11px; }
  .center { text-align:center; }
  .shop { font-size:15px; font-weight:bold; }
  .divider { border-top:1px dashed #000; margin:6px 0; }
  .row { display:flex; justify-content:space-between; }
  .bold { font-weight:bold; }
  .grand { border-top:1px solid #000; margin-top:4px; padding-top:4px; font-weight:bold; font-size:13px; }
  .footer { margin-top:8px; text-align:center; font-size:9px; }
</style></head><body>
<div class="center">
  <div class="shop">${settings.shop_name}</div>
  <div>${settings.shop_phone || ''}</div>
</div>
<div class="divider"></div>
<div class="center bold">PAYMENT RECEIPT</div>
<div class="row"><span>No:</span><span>${payment.receipt_no ?? '-'}</span></div>
<div class="row"><span>Date:</span><span>${formatDateTime(payment.payment_date)}</span></div>
<div class="divider"></div>
<div class="bold">Customer:</div>
<div>${customer?.full_name ?? '-'}</div>
${customer?.mobile ? `<div>${customer.mobile}</div>` : ''}
${sale?.invoice_no ? `<div class="row"><span>Invoice:</span><span>${sale.invoice_no}</span></div>` : ''}
<div class="divider"></div>
<div class="row"><span>Payment</span><span>${formatCurrency(payment.amount, settings.currency)}</span></div>
${payment.late_fee > 0 ? `<div class="row"><span>Late Fee</span><span>${formatCurrency(payment.late_fee, settings.currency)}</span></div>` : ''}
<div class="row grand"><span>TOTAL</span><span>${formatCurrency(payment.amount + payment.late_fee, settings.currency)}</span></div>
<div class="row"><span>Method</span><span>${payment.method}</span></div>
<div class="footer">Thank you!</div>
</body></html>`;

  printHTML(html);
}
