import { createStripeClient } from "../src/lib/stripe.server";
const s = createStripeClient("sandbox");
const eps = await s.webhookEndpoints.list({ limit: 20 });
console.log(JSON.stringify(eps.data.map(e=>({id:e.id,url:e.url,status:e.status,n:e.enabled_events.length,events:e.enabled_events})),null,1));
