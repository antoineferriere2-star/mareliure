const H = require("./harness.cjs");
(async () => {
  const b = await H.chromium.launch();
  for (let i = 0; i < 3; i++) {
    const { ctx } = await H.open(b, "customer", "MA_RELIURE", false);
    await ctx.addInitScript(() => { const orig = console.error; console.error = (...a) => { if (String(a[0]).includes("hasn't mounted")) orig("STACK " + new Error().stack); orig(...a); }; });
    const p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error" && m.text().startsWith("STACK")) console.log(m.text().split("\n").slice(0, 25).join("\n")); });
    await p.goto(`${H.BASE}/mes-livres/${H.FX["RL-QA-J1"].id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForTimeout(20000);
    console.log("--- run", i);
    await ctx.close();
  }
  await b.close();
})();
