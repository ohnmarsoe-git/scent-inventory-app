export type PreorderMoneyRow = {
  status: string;
  total_mmk: number;
  deposit_paid_mmk: number;
};

export function moneyLeft(totalMmk: number, paidMmk: number) {
  const total = Number(totalMmk) || 0;
  const paid = Number(paidMmk) || 0;
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

/**
 * Paid on orders still waiting is cash invested in bottles that have not
 * arrived. Left to pay includes those orders, plus received orders not
 * settled yet (pay on arrival).
 */
export function summarizePreorders(orders: PreorderMoneyRow[]) {
  let invested = 0;
  let left = 0;

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const paid = Number(order.deposit_paid_mmk) || 0;
    const due = moneyLeft(order.total_mmk, paid);
    const waiting =
      order.status === "draft" ||
      order.status === "ordered" ||
      order.status === "partially_received";
    if (waiting) invested += paid;
    if (waiting || order.status === "received") left += due;
  }

  return {
    invested: Math.round(invested * 100) / 100,
    left: Math.round(left * 100) / 100,
  };
}
