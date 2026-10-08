// Money actually received for one booking, split by how it was paid — shared by every
// admin booking API so the Accounts page shows the same thing for every service.
//
// How payments work in this app:
//   • the token is always paid online (Razorpay);
//   • the remaining balance is paid later, online or in cash — `payment_mode` on the
//     booking holds the mode of that balance payment;
//   • ride topups are paid separately, each with its own mode.
// So a ₹1000 booking with a ₹200 token and the rest in cash is ₹200 online + ₹800 cash,
// not ₹1000 cash.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param fare         booking amount without topups
 * @param tokenPaid    token has been paid
 * @param tokenAmount  token amount
 * @param balancePaid  the rest of the fare has been paid
 * @param balanceMode  'ONLINE' | 'CASH' — how the balance was paid
 * @param cancelled    booking is cancelled (nothing more is due)
 * @param extraOnline  paid topups taken online
 * @param extraCash    paid topups taken in cash
 */
const collectedSplit = ({
    fare, tokenPaid, tokenAmount, balancePaid, balanceMode, cancelled,
    extraOnline = 0, extraCash = 0,
}) => {
    const total   = (Number(fare) || 0);
    const token   = tokenPaid ? Math.min(Number(tokenAmount) || 0, total || Number(tokenAmount) || 0) : 0;
    const balance = balancePaid ? Math.max(0, total - token) : 0;
    const balanceOnline = String(balanceMode || '').toUpperCase() === 'ONLINE';

    const online = token + (balanceOnline ? balance : 0) + (Number(extraOnline) || 0);
    const cash   = (balanceOnline ? 0 : balance) + (Number(extraCash) || 0);
    const collected = online + cash;
    const grandTotal = total + (Number(extraOnline) || 0) + (Number(extraCash) || 0);

    return {
        collected_online: round2(online),
        collected_cash: round2(cash),
        collected_total: round2(collected),
        // what is still to come from the customer; a cancelled booking owes nothing more
        due_amount: cancelled ? 0 : round2(Math.max(0, grandTotal - collected)),
    };
};

module.exports = { collectedSplit, round2 };
