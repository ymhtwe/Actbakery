import { forwardRef } from "react";

export interface ReceiptLineItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface ReceiptPrintProps {
  customerName: string;
  date: string;
  receiptNo?: string;
  items: ReceiptLineItem[];
  grandTotal: number;
  shopName?: string;
}

export const ReceiptPrint = forwardRef<HTMLDivElement, ReceiptPrintProps>(
  ({ customerName, date, receiptNo, items, grandTotal, shopName = "ACT Bakery" }, ref) => {
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("my-MM", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const formatNumber = (n: number) =>
      n.toLocaleString("en-US");

    return (
      <div ref={ref} className="receipt-print-area hidden print:block">
        <div className="receipt-page">
          {/* Header */}
          <div className="receipt-header">
            <h1 className="receipt-shop-name">{shopName}</h1>
            <h2 className="receipt-title">ငွေလက်ငင်းဖြတ်ပိုင်း</h2>
          </div>

          {/* Meta */}
          <div className="receipt-meta">
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">၀ယ်သူ:</span>
              <span className="receipt-meta-value">{customerName}</span>
            </div>
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">နေ့စွဲ:</span>
              <span className="receipt-meta-value">{formatDate(date)}</span>
            </div>
            {receiptNo && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">အမှတ်:</span>
                <span className="receipt-meta-value">{receiptNo}</span>
              </div>
            )}
          </div>

          <div className="receipt-divider"></div>

          {/* Table */}
          <table className="receipt-table">
            <thead>
              <tr>
                <th className="receipt-th receipt-th-name">ပစ္စည်း</th>
                <th className="receipt-th receipt-th-qty">ခု</th>
                <th className="receipt-th receipt-th-price">ဈေး</th>
                <th className="receipt-th receipt-th-total">ပေါင်း</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="receipt-tr">
                  <td className="receipt-td receipt-td-name">{item.name}</td>
                  <td className="receipt-td receipt-td-qty">{item.quantity}</td>
                  <td className="receipt-td receipt-td-price">{formatNumber(item.price)}</td>
                  <td className="receipt-td receipt-td-total">{formatNumber(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="receipt-divider"></div>

          {/* Footer */}
          <div className="receipt-footer">
            <div className="receipt-grand-total">
              <span className="receipt-grand-total-label">စုစုပေါင်း</span>
              <span className="receipt-grand-total-value">{formatNumber(grandTotal)} ကျပ်</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ReceiptPrint.displayName = "ReceiptPrint";
