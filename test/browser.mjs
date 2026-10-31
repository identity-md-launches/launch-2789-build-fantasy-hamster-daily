// Production-export checks. Synthetic data exists only in this test, never in the app.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import {
  dailyCards,
  pricesFor,
  rosterScore,
  rosterOutcomes,
} from "../src/core/game.ts";
import { parseSettlements } from "../src/core/data.ts";
import { addDays, dayKey, dayStart, WATCH_MS } from "../src/core/dates.ts";
import { encodeRival } from "../src/core/share.ts";
import { emptyState, STORAGE_KEY } from "../src/core/storage.ts";

const { chromium, webkit } = await import(
  process.env.FH_PLAYWRIGHT || "playwright"
);
const { default: AxeBuilder } = await import(
  process.env.FH_AXE || "@axe-core/playwright"
);
const output = resolve("test/scratch/interaction");
await mkdir(output, { recursive: true });
const root = resolve("dist");
const prefix = "/ipfs/fantasy-hamster/";
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://local").pathname;
    if (!path.startsWith(prefix)) {
      response.writeHead(404).end();
      return;
    }
    const file = resolve(
      root,
      decodeURIComponent(path.slice(prefix.length)) || "index.html",
    );
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const contents = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
    });
    response.end(contents);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
const now = dayStart(dayKey()) + 18 * 3600000;
const today = dayKey(now),
  tomorrow = addDays(today, 1),
  yesterday = addDays(today, -1);
const summary = [];
const record = (name, detail) => {
  summary.push({ name, passed: true, detail });
  console.log(`PASS ${name}${detail ? ": " + detail : ""}`);
};

function rawBucket(start) {
  const complete = start + WATCH_MS <= now;
  const watch = new Date(start).getUTCHours() / 6;
  const work = complete ? [6000, 3000, 0, 1000][watch] : 0;
  return {
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + WATCH_MS).toISOString(),
    activeRoundCount: String(work ? 8 : 0),
    workAdded: String(work),
    completedBlockCount: String(Math.floor(work / 10)),
  };
}
const payload = {
  generatedAt: new Date(now).toISOString(),
  window: {
    startAt: new Date(
      dayStart(addDays(today, -6)) + 2 * WATCH_MS,
    ).toISOString(),
    endAt: new Date(dayStart(tomorrow) + 2 * WATCH_MS).toISOString(),
    bucketSeconds: 21600,
  },
  buckets: Array.from({ length: 28 }, (_, i) =>
    rawBucket(dayStart(addDays(today, -6)) + (2 + i) * WATCH_MS),
  ),
};
const wheel = {
  measurement: {
    freshness: "online",
    coreStatus: "IDLE",
    rpmMilli: "0",
    cumulativeWorkUnits: "123456",
    observedAt: new Date(now).toISOString(),
    staleAfterSeconds: "120",
  },
  builder: { anchor: { blockHeight: "12345" } },
};
const completeHistory = parseSettlements(
  {
    ...payload,
    window: {
      ...payload.window,
      startAt: new Date(dayStart(addDays(today, -20))).toISOString(),
    },
    buckets: Array.from({ length: 80 }, (_, i) =>
      rawBucket(dayStart(addDays(today, -20)) + i * WATCH_MS),
    ),
  },
  now,
).days;
function makeRoster(day, name = "Test rival") {
  const picks = dailyCards(day)
    .slice(0, 5)
    .map((e) => e.id);
  return { day, name, picks, captain: picks[0] };
}
function makeDraft(day) {
  return {
    ...makeRoster(day, "Test player"),
    savedAt: dayStart(day) - 3600000,
    prices: pricesFor(day, completeHistory),
  };
}

async function contextFor(
  browser,
  {
    state,
    status = wheel,
    settlement = payload,
    viewport = { width: 390, height: 844 },
    lost = false,
  } = {},
) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
  });
  if (state)
    await context.addInitScript(
      ({ state, key }) => {
        if (!sessionStorage.getItem("test-seeded")) {
          localStorage.setItem(key, JSON.stringify(state));
          sessionStorage.setItem("test-seeded", "yes");
        }
      },
      { state, key: STORAGE_KEY },
    );
  await context.route("https://api.squeekchain.com/v1/**", (route) =>
    lost
      ? route.abort("failed")
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            route.request().url().includes("settlements") ? settlement : status,
          ),
        }),
  );
  const page = await context.newPage();
  await page.clock.install({ time: now });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const missing = [];
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 400)
      missing.push(response.url());
  });
  return { context, page, errors, missing };
}
async function loaded(page, hash = "") {
  await page.goto(base + hash);
  await page.locator(".event-card").first().waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".card-points")?.textContent?.includes("?"),
  );
}
async function overflow(page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}
async function until(predicate, message) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

try {
  for (const [engine, browserType] of [
    ["Chromium", chromium],
    ["WebKit", webkit],
  ]) {
    let browser;
    try {
      browser = await browserType.launch({
        headless: true,
        ...(engine === "WebKit" && process.env.FH_WEBKIT_EXECUTABLE
          ? { executablePath: process.env.FH_WEBKIT_EXECUTABLE }
          : {}),
      });
    } catch (error) {
      if (engine === "Chromium") throw error;
      summary.push({
        name: "WebKit browser launch",
        passed: false,
        limitation: error.message.split("\n").slice(0, 12).join("\n"),
      });
      process.exitCode = 1;
      console.log(
        "LIMITATION WebKit: " + error.message.split("\n").slice(0, 4).join(" "),
      );
      continue;
    }
    try {
      const { context, page, errors, missing } = await contextFor(browser);
      await loaded(page);
      assert.equal(await page.locator(".event-card").count(), 12);
      assert.equal(await overflow(page), false);
      const pickBox = await page.locator(".pick-button").first().boundingBox();
      assert.ok(
        pickBox.y + pickBox.height <= 844,
        `First pick is below the screen: ${JSON.stringify(pickBox)}`,
      );
      await page.screenshot({
        path: `${output}/${engine.toLowerCase()}-390.png`,
      });
      await page
        .getByRole("button", { name: "Save tomorrow’s team", exact: true })
        .click();
      assert.match(
        await page.locator(".form-message").innerText(),
        /Pick 5 more/,
      );
      const events = dailyCards(tomorrow).slice(0, 5);
      for (const event of events)
        await page
          .getByRole("button", { name: `Pick ${event.name}`, exact: true })
          .click();
      assert.equal(await page.locator(".event-card.selected").count(), 5);
      assert.equal(await page.locator(".pick-button:disabled").count(), 7);
      await page
        .getByRole("button", {
          name: "Five picked. Review your team",
          exact: true,
        })
        .click();
      assert.equal(
        await page
          .locator("#team-heading")
          .evaluate((el) => document.activeElement === el),
        true,
      );
      await page
        .getByRole("button", { name: "Save tomorrow’s team", exact: true })
        .click();
      assert.match(
        await page.locator(".form-message").innerText(),
        /Choose a Captain/,
      );
      await page
        .getByRole("button", {
          name: `Make ${events[0].name} Captain`,
          exact: true,
        })
        .click();
      await page
        .getByRole("textbox", { name: "Your display name (optional)" })
        .fill("A tiny rival");
      await page
        .getByRole("button", { name: "Save tomorrow’s team", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Draft saved", exact: true })
        .waitFor();
      const saved = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).drafts,
        STORAGE_KEY,
      );
      assert.equal(saved[tomorrow].captain, events[0].id);
      assert.equal(saved[tomorrow].picks.length, 5);
      await page.getByRole("button", { name: "My picks", exact: true }).click();
      assert.equal(await page.locator(".event-card").count(), 5);
      await page
        .getByRole("button", { name: "All cards", exact: true })
        .click();
      assert.equal(await page.locator(".event-card").count(), 12);
      await page.reload();
      await page
        .getByRole("button", { name: "Draft saved", exact: true })
        .waitFor();
      assert.equal(await page.locator(".event-card.selected").count(), 5);
      const help = page.getByRole("button", {
        name: "How to play",
        exact: true,
      });
      await help.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      assert.equal(
        await help.evaluate((el) => document.activeElement === el),
        true,
      );
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: () => Promise.reject(new Error("test denied")) },
        }),
      );
      await page
        .getByRole("button", { name: "Copy rival link", exact: true })
        .click();
      const rivalLink = await page
        .locator(".manual-copy textarea")
        .inputValue();
      assert.ok(rivalLink.includes("#rival="));
      await page.goto(rivalLink);
      await page
        .getByRole("button", { name: "Add rival", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Rival added", exact: true })
        .waitFor();
      assert.equal(await page.locator(".comparison-roster").count(), 2);
      assert.equal(await page.locator(".ranking-list li").count(), 2);
      assert.equal(await overflow(page), false);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(missing, []);
      record(
        `${engine} complete draft + keyboard help + persistence + share fallback + rival H2H`,
        "5 picks, Captain, validation, reload, 2 ranked teams, zero axe violations",
      );
      await context.close();

      const resultState = emptyState();
      resultState.days = completeHistory;
      resultState.drafts[yesterday] = makeDraft(yesterday);
      resultState.drafts[today] = makeDraft(today);
      const resultContext = await contextFor(browser, { state: resultState });
      const resultPage = resultContext.page;
      await resultPage.goto(base + "#results");
      await resultPage
        .getByRole("button", { name: "Reveal my result", exact: true })
        .click();
      for (let i = 0; i < 5; i++) await resultPage.clock.runFor(100);
      await resultPage
        .getByRole("button", { name: "Copy result", exact: true })
        .waitFor();
      assert.equal(await resultPage.locator(".flip-card.flipped").count(), 5);
      const score = await resultPage.evaluate(
        ({ key, day }) => JSON.parse(localStorage.getItem(key)).scores[day],
        { key: STORAGE_KEY, day: yesterday },
      );
      assert.equal(
        score.score,
        rosterScore(
          resultState.drafts[yesterday],
          completeHistory,
          resultState.drafts[yesterday].prices,
        ),
      );
      const share = resultPage.getByRole("link", {
        name: "Share on X",
        exact: false,
      });
      assert.ok(
        (await share.getAttribute("href")).startsWith(
          "https://x.com/intent/tweet?text=",
        ),
      );
      await resultPage.screenshot({
        path: `${output}/${engine.toLowerCase()}-result.png`,
        fullPage: true,
      });
      await resultPage
        .getByRole("link", { name: "Today Live", exact: false })
        .click();
      await resultPage.locator(".live-roster .event-card").first().waitFor();
      assert.equal(
        await resultPage.locator(".live-roster .event-card").count(),
        5,
      );
      const expectedOutcomes = rosterOutcomes(
        resultState.drafts[today],
        parseSettlements(payload, now).days,
      );
      assert.equal(
        await resultPage.locator(".live-roster .hit").count(),
        expectedOutcomes.filter((o) => o === "hit").length,
      );
      assert.equal(await resultPage.locator(".unknown-watch").count(), 1);
      assert.equal(await overflow(resultPage), false);
      record(
        `${engine} result reveal + saved score + live roster`,
        `5 staged flips; exact ${score.score}-point score; last watch unknown`,
      );
      await resultContext.context.close();

      const progressPayload = structuredClone(payload);
      Object.assign(progressPayload.buckets.find((b) => b.startAt === new Date(dayStart(today) + 3 * WATCH_MS).toISOString()), {
        activeRoundCount: "40", workAdded: "9000", completedBlockCount: "1400",
      });
      const progressState = emptyState(); progressState.drafts[today] = makeDraft(today);
      const progress = await contextFor(browser, { state: progressState, settlement: progressPayload });
      await progress.page.goto(base + "#live");
      await progress.page.getByText(/9,000 work · In progress/).waitFor();
      assert.equal(await progress.page.locator(".watch.active-watch").count(), 3);
      assert.equal(await progress.page.locator(".live-roster .outcome-hit").count(), 3);
      assert.equal(await overflow(progress.page), false);
      record(`${engine} in-progress live evidence`, "Positive Night watch counts hit Overtime, Clocked In and Triple Shift before midnight; unfinished watch stays labelled In progress");
      await progress.context.close();

      // Reopened findings: realistic rival names, stale tabs and independent feed failures.
      const longName = "W".repeat(16);
      const long = await contextFor(browser);
      await long.page.goto(base + encodeRival(makeRoster(addDays(today, -12), longName)));
      await long.page.getByRole("button", { name: "Add rival", exact: true }).click();
      for (const width of [320, 360, 390, 760, 1440]) {
        await long.page.setViewportSize({ width, height: 844 });
        assert.equal(await overflow(long.page), false, `${engine} expired long rival at ${width}`);
        assert.equal(await long.page.locator(".comparison-heading h3").innerText(), longName);
        assert.equal(await long.page.locator(".comparison-outcome").allTextContents().then((x) => x.every((s) => s === "Expired")), true);
      }
      await long.page.setViewportSize({ width: 390, height: 844 });
      await long.page.locator(".comparison-roster").scrollIntoViewIfNeeded();
      await long.page.screenshot({ path: `${output}/${engine.toLowerCase()}-long-rival.png` });
      await long.page.goto(base + encodeRival(makeRoster(tomorrow, longName)));
      await long.page.getByRole("button", { name: "Add rival", exact: true }).click();
      await long.page.setViewportSize({ width: 320, height: 844 });
      assert.equal(await overflow(long.page), false, `${engine} priced long rival at 320`);
      assert.match(await long.page.locator(".comparison-heading strong").innerText(), /\d+ pts/);
      record(`${engine} long rival reflow`, "All 16 characters, expired outcomes and numeric scores fit; 320/360/390/760/1440px");
      await long.context.close();

      const multi = await contextFor(browser);
      await loaded(multi.page);
      const tabB = await multi.context.newPage();
      await tabB.clock.install({ time: now + 1000 });
      await loaded(tabB);
      const overlayTab = await multi.context.newPage();
      await overlayTab.clock.install({ time: now });
      await overlayTab.goto(base + "?overlay=1");
      await overlayTab.locator(".overlay-empty").waitFor();
      const availableEvents = dailyCards(tomorrow).filter((e) => pricesFor(tomorrow, parseSettlements(payload, now).days)[e.id]?.points != null);
      for (const event of availableEvents.slice(0, 5)) await tabB.getByRole("button", { name: `Pick ${event.name}`, exact: true }).click();
      await tabB.getByRole("button", { name: `Make ${availableEvents[0].name} Captain`, exact: true }).click();
      await tabB.getByRole("button", { name: "Save tomorrow’s team", exact: true }).click();
      await tabB.getByRole("button", { name: "Draft saved", exact: true }).waitFor();
      await multi.page.waitForFunction(() => document.querySelectorAll(".event-card.selected").length === 5);
      await overlayTab.locator(".overlay-cards .event-card").first().waitFor();
      assert.equal(await overlayTab.locator(".event-card").count(), 5);
      for (const page of [multi.page, overlayTab]) {
        await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
        await page.clock.runFor(100);
      }
      await multi.page.getByRole("button", { name: "Draft saved", exact: true }).waitFor();
      assert.ok(await multi.page.evaluate(({ key, day }) => !!JSON.parse(localStorage.getItem(key)).drafts[day], { key: STORAGE_KEY, day: tomorrow }));
      // Storage synchronization must not reset an unsaved local selection on a name change.
      await multi.page.getByRole("button", { name: `Remove ${availableEvents[0].name}`, exact: true }).click();
      await multi.page.getByRole("button", { name: `Pick ${availableEvents[5].name}`, exact: true }).click();
      await multi.page.getByRole("textbox", { name: "Your display name (optional)" }).fill("Edited here");
      assert.equal(await multi.page.getByRole("button", { name: `Remove ${availableEvents[5].name}`, exact: true }).count(), 1);
      const archived = makeDraft(yesterday);
      const archiveScore = { day: yesterday, roster: archived, score: rosterScore(archived, completeHistory, archived.prices), outcomes: rosterOutcomes(archived, completeHistory) };
      await tabB.evaluate(({ key, archived, score, rival }) => {
        const state = JSON.parse(localStorage.getItem(key));
        state.drafts[archived.day] = archived;
        state.scores[archived.day] = score;
        state.rivals[rival.day] = [rival];
        state.revealed = [archived.day];
        localStorage.setItem(key, JSON.stringify(state));
      }, { key: STORAGE_KEY, archived, score: archiveScore, rival: makeRoster(tomorrow, longName) });
      await multi.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await multi.page.clock.runFor(100);
      const retained = await multi.page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
      assert.ok(retained.drafts[tomorrow]);
      assert.deepEqual(retained.scores[yesterday], archiveScore);
      assert.equal(retained.rivals[tomorrow][0].name, longName);
      assert.ok(retained.revealed.includes(yesterday));
      await tabB.close(); await overlayTab.close();
      await multi.page.reload();
      await multi.page.getByRole("button", { name: "Draft saved", exact: true }).waitFor();
      assert.equal(await multi.page.locator(".event-card.selected").count(), 5);
      record(`${engine} tabs and overlay share storage safely`, "B saves; A and OBS synchronize; visibility refetch and reload retain draft, archived score, rival and reveal; local edits survive name changes");
      await multi.context.close();

      for (const raw of ['{broken', '{"version":2,"scores":{"2026-10-20":{"score":500}},"drafts":{}}']) {
        const unreadable = await contextFor(browser);
        await unreadable.context.addInitScript(({ key, raw }) => {
          if (!sessionStorage.getItem("corrupt-seeded")) {
            localStorage.setItem(key, raw); sessionStorage.setItem("corrupt-seeded", "yes");
          }
        }, { key: STORAGE_KEY, raw });
        await loaded(unreadable.page);
        await unreadable.page.getByText(/Existing unreadable data is preserved/).waitFor();
        await unreadable.page.getByRole("textbox", { name: "Your display name (optional)" }).fill("Visit only");
        assert.equal(await unreadable.page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), raw);
        assert.deepEqual(unreadable.errors, []);
        await unreadable.context.close();
      }
      record(`${engine} unreadable storage protection`, "Malformed JSON and a future schema remain byte-identical after loading and editing");

      for (const failureMode of ["results", "status", "both", "first-results", "first-both", "counter-fault", "stale", "no-anchor"]) {
        const feed = await contextFor(browser, { viewport: { width: 1920, height: 1080 } });
        await feed.page.clock.pauseAt(now);
        let fail = failureMode.startsWith("first-");
        let resultCalls = 0;
        await feed.context.unroute("https://api.squeekchain.com/v1/**");
        await feed.context.route("https://api.squeekchain.com/v1/**", (route) => {
          const results = route.request().url().includes("settlements");
          if (results) resultCalls++;
          const affected = failureMode.includes("both") || (results ? failureMode.includes("results") : failureMode === "status");
          if (fail && affected) return route.fulfill({ status: 503, body: "unavailable" });
          return route.fulfill({ json: results ? payload : {
            ...wheel,
            builder: failureMode === "no-anchor" ? { status: "unavailable", anchor: null } : wheel.builder,
            measurement: {
              ...wheel.measurement,
              coreStatus: failureMode === "counter-fault" ? "COUNTER_FAULT" : "IDLE",
              freshness: failureMode === "stale" ? "stale" : "online",
              staleAfterSeconds: 3600,
            },
          } });
        });
        await feed.page.goto(base + "?overlay=1" + encodeRival(makeRoster(today)));
        await feed.page.locator(".overlay-cards .outcome").first().waitFor();
        if (!failureMode.startsWith("first-") && ["results", "status", "both"].includes(failureMode)) {
          await feed.page.locator(".hamster-scene.sleeping").waitFor();
          const outcomes = await feed.page.locator(".outcome").allTextContents();
          fail = true;
          await feed.page.clock.runFor(301000);
          await feed.page.getByText(/Signal lost/).waitFor();
          assert.deepEqual(await feed.page.locator(".outcome").allTextContents(), outcomes);
          if (failureMode !== "status") assert.equal(resultCalls, 2);
        }
        const caption = await feed.page.locator(".overlay-hamster").innerText();
        if (["results", "status", "both"].includes(failureMode)) {
          assert.match(caption, /Signal lost/);
          assert.match(caption, /last received 18:00:00 UTC/);
        } else if (failureMode.startsWith("first-")) {
          await feed.page.getByText(/Signal lost/).waitFor();
          assert.match(await feed.page.locator(".overlay-hamster").innerText(), /never on this visit/);
        } else {
          await feed.page.locator(failureMode === "no-anchor" ? ".hamster-scene.sleeping" : ".hamster-scene.confused").waitFor();
          assert.match(await feed.page.locator(".overlay-hamster").innerText(), failureMode === "counter-fault" ? /Counter fault/ : failureMode === "stale" ? /Wheel measurement stale/ : /Resting up/);
          assert.doesNotMatch(caption, /Signal lost/);
        }
        if (failureMode.includes("results") || failureMode.includes("both")) assert.match(await feed.page.locator(".overlay-hamster").innerText(), /outcomes are last-known/);
        assert.equal(await feed.page.locator("button, input, select, a, textarea").count(), 0);
        const box = await feed.page.locator(".obs-overlay").boundingBox();
        assert.ok(box.y >= 720 && box.y + box.height <= 1080, `Overlay ${failureMode} must stay in lower third: ${JSON.stringify(box)}`);
        if (failureMode === "both") await feed.page.screenshot({ path: `${output}/${engine.toLowerCase()}-overlay-lost.png`, omitBackground: true });
        assert.deepEqual(feed.errors, []);
        await feed.context.close();
      }
      record(`${engine} overlay feed integrity`, "Independent failures, first-load failures, last-good times, retained outcomes, distinct counter fault/stale labels, null anchor; no controls and fits lower third");

      if (engine === "Chromium") {
        for (const width of [320, 390, 580, 760, 960, 1440]) {
          const check = await contextFor(browser, {
            viewport: { width, height: 900 },
          });
          await loaded(check.page);
          assert.equal(
            await overflow(check.page),
            false,
            `${width}px overflow`,
          );
          if (width === 1440)
            await check.page.screenshot({ path: `${output}/desktop-1440.png` });
          const axe = await new AxeBuilder({ page: check.page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          assert.deepEqual(
            axe.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
            [],
            `${width}px axe`,
          );
          await check.context.close();
        }
        record(
          "Responsive export at nested IPFS path",
          "320, 390, 580, 760, 960, 1440; no overflow or axe violations",
        );

        const enlarged = await contextFor(browser);
        await loaded(enlarged.page);
        await enlarged.page.evaluate(
          () => (document.documentElement.style.fontSize = "200%"),
        );
        assert.equal(
          await overflow(enlarged.page),
          false,
          "200% text at 390px must reflow",
        );
        record(
          "Text enlargement",
          "200% root text at 390px reflows without horizontal overflow; not native browser zoom",
        );
        await enlarged.context.close();

        const obs = await contextFor(browser, {
          viewport: { width: 1920, height: 1080 },
        });
        await obs.page.goto(
          base + "?overlay=1" + encodeRival(makeRoster(today)),
        );
        await obs.page.locator(".overlay-cards .event-card").first().waitFor();
        assert.equal(
          await obs.page.locator(".overlay-cards .event-card").count(),
          5,
        );
        assert.equal(
          await obs.page.locator("button, input, select, a, textarea").count(),
          0,
        );
        assert.equal(
          await obs.page.evaluate(
            () => getComputedStyle(document.body).backgroundColor,
          ),
          "rgba(0, 0, 0, 0)",
        );
        const box = await obs.page.locator(".obs-overlay").boundingBox();
        assert.ok(box.y >= 720 && box.y + box.height <= 1080);
        await obs.page.screenshot({
          path: `${output}/overlay-1920.png`,
          omitBackground: true,
        });
        record(
          "OBS lower third",
          "1920×1080; 5 live cards; transparent; no controls; within lower third",
        );
        await obs.context.close();

        const expiredState = emptyState();
        const expiredDay = addDays(today, -12);
        expiredState.drafts[expiredDay] = makeDraft(expiredDay);
        const expired = await contextFor(browser, { state: expiredState });
        await expired.page.goto(base + "#results");
        await expired.page.locator("select").selectOption(expiredDay);
        await expired.page
          .getByRole("heading", { name: "Result expired", exact: true })
          .waitFor();
        record(
          "Expired day",
          "An unsaved day outside the API window says Result expired",
        );
        await expired.context.close();

        const failure = await contextFor(browser, { lost: true });
        await failure.page.goto(base);
        await failure.page.getByText("Signal lost", { exact: true }).waitFor();
        assert.match(
          await failure.page.locator(".signal-notice").innerText(),
          /never on this visit/,
        );
        assert.equal(
          await failure.page.locator(".hamster-scene.confused").count(),
          1,
        );
        record(
          "API failure",
          "Signal lost; honest last-known time; confused hamster; no fabricated prices",
        );
        await failure.context.close();

        const blocked = await contextFor(browser);
        await blocked.context.addInitScript(() =>
          Object.defineProperty(window, "localStorage", {
            configurable: true,
            get: () => {
              throw new Error("test blocked");
            },
          }),
        );
        await loaded(blocked.page);
        assert.match(
          await blocked.page.locator(".notice").innerText(),
          /Browser storage is unavailable/,
        );
        assert.deepEqual(blocked.errors, []);
        record(
          "Blocked browser storage",
          "Explicit visit-only warning and usable draft",
        );
        await blocked.context.close();

        const polling = await contextFor(browser);
        await polling.page.clock.pauseAt(now + 1000);
        let statusCalls = 0,
          settlementCalls = 0;
        await polling.context.unroute("https://api.squeekchain.com/v1/**");
        await polling.context.route(
          "https://api.squeekchain.com/v1/**",
          (route) => {
            if (route.request().url().includes("settlements")) {
              settlementCalls++;
              return route.fulfill({ json: payload });
            }
            statusCalls++;
            return route.fulfill(
              statusCalls === 1
                ? {
                    status: 429,
                    headers: {
                      "Retry-After": "120",
                      "Access-Control-Expose-Headers": "Retry-After",
                    },
                    body: "",
                  }
                : { json: wheel },
            );
          },
        );
        await polling.page.goto(base);
        await polling.page
          .getByText("Signal lost · API rate limit", { exact: true })
          .waitFor();
        await polling.page.clock.runFor(119000);
        assert.equal(statusCalls, 1);
        assert.equal(
          await polling.page
            .getByRole("button", { name: "Retry signal" })
            .isDisabled(),
          true,
        );
        await polling.page.clock.runFor(1100);
        await until(() => statusCalls === 2, "Retry resumes after 120 seconds");
        assert.equal(statusCalls, 2);
        await polling.page
          .locator(".signal-notice")
          .waitFor({ state: "detached" });
        await polling.page.clock.runFor(20100);
        await until(
          () => statusCalls === 3,
          "Normal status polling resumes after backoff",
        );
        assert.equal(statusCalls, 3);
        assert.equal(settlementCalls, 1);
        await polling.page.evaluate(() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        const before = statusCalls;
        await polling.page.clock.runFor(300000);
        assert.equal(statusCalls, before);
        assert.equal(settlementCalls, 1);
        await polling.page.evaluate(() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => false,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await polling.page.clock.runFor(100);
        await until(
          () => statusCalls === before + 1 && settlementCalls === 2,
          "Both feeds refresh on visible resume",
        );
        assert.equal(statusCalls, before + 1);
        assert.equal(settlementCalls, 2);
        record(
          "Polling and backoff",
          "20s status; 5m settlements; Retry-After=120s honored; hidden tab pauses both; resume refreshes",
        );
        await polling.context.close();

        const boundary = await contextFor(browser);
        await boundary.page.clock.setFixedTime(dayStart(tomorrow) - 1);
        await loaded(boundary.page);
        assert.ok(
          (
            await boundary.page
              .locator(".section-heading p")
              .first()
              .innerText()
          ).includes("#"),
        );
        const firstCard = await boundary.page
          .locator(".event-card h3")
          .first()
          .innerText();
        await boundary.page.clock.setFixedTime(dayStart(tomorrow));
        await boundary.page.clock.runFor(1100);
        await boundary.page.waitForFunction(
          (text) =>
            document.querySelector(".event-card h3")?.textContent !== text,
          firstCard,
        );
        assert.equal(
          await boundary.page.locator(".event-card.selected").count(),
          0,
        );
        record(
          "UTC midnight rollover",
          "New tomorrow pack replaces the now-locked draft",
        );
        await boundary.context.close();
      }
    } finally {
      await browser.close();
    }
  }
  console.log(
    JSON.stringify(
      {
        checks: summary,
        limitation: "Emulation is not a physical-device or screen-reader test.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.close();
}
