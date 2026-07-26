import { createStripeClient } from "../src/lib/stripe.server";
const s = createStripeClient("sandbox");
const sub = await s.subscriptions.retrieve("sub_1TxNWHPcf5JMvDdLUDKs1ZoA");
console.log("before:", sub.status, "cancel_at_period_end:", sub.cancel_at_period_end);
const c = await s.subscriptions.cancel("sub_1TxNWHPcf5JMvDdLUDKs1ZoA");
console.log("after immediate cancel:", c.status);
