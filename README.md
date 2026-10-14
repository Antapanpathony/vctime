# Term Sheet

*Coffee Inc., with the coffee deleted.* You run a VC fund and the only product is returns.
Turn-based (one week per turn, ~10 action points), Canvas 2D, a single HTML file, fully offline.

**Play:** open [`index.html`](index.html) in any modern browser. No server, no network, no dependencies.

This is the **Phase 1 build** from the design doc: the investing core. Fairs, rival-VC dynamics, the crypto
sleeve, jets/charters and Fund II+ are later phases (see [Roadmap](#roadmap)).

## How to play

1. **Set up Fund I**: fund size, home city, thesis (stage range, 1-3 sectors, geography, typical check size) and reserves.
2. Each week you have **10 AP**. Spend them, then **End week** (`Space`). Unspent AP is lost.
3. **Pipeline**: Sourced → Screened → Meeting → Diligence → Term sheet. Every move costs AP, and founders need a
   week between steps (hot deals are the exception). Click a card to open the deal room, or use the `▶` button.
4. **Diligence** reveals hidden stats (founder, product-market fit, burn discipline, timing, integrity, tech) through noisy
   tools. You only ever see confidence bars. Founders bluff: contradictions between tools are your signal, and
   frauds exist. Skip diligence and a fraud scams you in proportion to what you skipped.
5. **Term sheet**: lead or follow, valuation, check size, board seat, pro-rata, option pool, liquidation preference,
   anti-dilution, SAFE cap / MFN / discount. Founders weigh price, terms, your brand, speed and value-add against rival
   offers. Founder-friendly terms win deals but cost returns; aggressive terms hurt relationships.
6. **Portfolio**: quarterly updates (which can be spun), help actions, follow-ons (a signal to the market), crises
   (bridge, pivot, sell, shut down), board votes, exits (M&A, IPO with lock-ups, stock deals, secondaries, acqui-hires).
7. After **10 years** the fund is scored on net IRR, TVPI and DPI plus a small reputation bonus. Personal wealth never counts.

| Key | Action |
| --- | --- |
| `Space` / `Enter` | End week |
| `1`-`5` | Pipeline / Portfolio / Fund / Office / Market |
| `Esc` | Close dialog / open menu |
| hover | Explains almost everything |

The game autosaves to `localStorage` every week. Seeds are reproducible: the same seed gives the same heat cycles,
macro regimes and (largely) the same deal flow whatever you do, so you can compare strategies.

## What is in Phase 1

- **Fund thesis and construction**: stage / sector / geography / check size; thesis fit speeds diligence and improves
  sourcing; **drift** costs LP trust; initial checks vs a **reserve pool** for follow-ons; concentration vs diversification.
- **Procedural startups** (7 sectors, 7 cities, founder quirks that hint at hidden stats), real **cap tables** (SAFEs,
  priced rounds, pool top-ups, dilution, pro-rata, liquidation preferences, down rounds and anti-dilution fights).
- **Power-law outcomes**: most die, many return roughly 1x, a few return 50x+ (see *Balance* below).
- **Sector hype waves** and a **macro regime** cycle (bull / neutral / bear / recession) that move valuations, exit
  multiples and the IPO window.
- **Sourcing channels** with different volume and quality: inbound, referrals, scouts, cold outreach, hot deals.
- **Competition**: ten NPC firms with styles and brands; reputation gates the best founders and decides win rates.
- **Diligence toolkit**: data room, founder references, customer calls, technical expert, background check, and **HQ
  visits** (an office scene with clues: empty desks, a burn whiteboard, a founder who dodges questions).
- **Travel**: commercial flights are free but cost AP (local / regional / intercontinental, with delays); a binary **car**.
- **Events**: cofounder blow-ups, runway crises, key customer lost, competitor mega-round, regulatory trouble, scandals,
  poaching, down-round ultimatums, acqui-hires, hot deals, LP asking for early liquidity, term-sheet leaks.
- **Dashboard**: portfolio table, cap tables, J-curve, LP reports, market and rival screens.

## Project layout

```
index.html            the built game (single file, committed so it just works)
src/00_core.js        RNG, formatting, static data (sectors, cities, stages, macro, rival firms)
src/10_sim.js         state, startup generation, cap-table math, rounds, valuations, exit waterfall
src/15_world.js       weekly engine: startup growth, fundraising, crises, exits, sourcing, macro
src/20_actions.js     everything the player spends AP on (pipeline, diligence, terms, help, staff)
src/25_metrics.js     NAV, TVPI / DPI / net IRR, scoring
src/30_events.js      decision events (text, options, resolution)
src/40_ui.js          immediate-mode Canvas widget toolkit (buttons, sliders, scroll areas, charts, tooltips)
src/50_screens_a.js   frame, setup, pipeline, deal room, term-sheet builder, HQ scene
src/55_screens_b.js   portfolio, fund, office, market, event / menu / help / end-of-fund dialogs
src/60_main.js        canvas scaling, input, loop, save / load
build.js              concatenates src/*.js into index.html
tools/                headless tests and balance harnesses (Node)
```

The sim files (`00`-`30`) have no DOM dependency, so the whole game runs headlessly in Node for testing.

## Build and test

```bash
node build.js                    # src/*.js -> index.html
node tools/fuzz.js 12            # 12 random-action full games, checks invariants
node tools/determinism.js        # same seed => same world regardless of play
node tools/smoke2.js             # real mouse-driven UI test in headless Chromium (needs Playwright)
node tools/smoke.js              # screenshots of every screen (needs Playwright)
node tools/balance.js 2          # "spray" bot outcome distribution
node tools/efficiency.js 2000 1  # return of buying every round, by stage
node tools/playbot.js 6 2        # bots: 0 = naive, 1 = diligence-aware, 2 = oracle (sees true stats)
```

Playwright is only needed for the two `smoke` scripts; set `PLAYWRIGHT_PATH` / `CHROMIUM` if it is not on the default path.

## Balance notes

Tuning constants live in `src/00_core.js` (stage valuations, ARR benchmarks, macro regimes, costs) and the growth
model in `src/15_world.js` (`growthMo`). The harnesses above are the intended way to retune. Current targets:

- Buying every round blindly at the round price: median below 1x, mean around 1x, a thin tail to 20x+ (stage-dependent).
- A bot with perfect information about hidden stats reaches roughly 2-3x net TVPI; naive and random play loses money
  to fees. Skill (diligence, reputation, reserves, follow-ons) is what moves the result.
- Help actions have diminishing returns per company (an uncapped version was an infinite-money exploit).

## Design decisions (where the design doc was open)

- **Fund economics**: choose $3M / $5M / $10M; you commit 2% from your $250k. 2% fee, 20% carry on a whole-fund basis with
  no hurdle, paid once distributions exceed paid-in capital. The fee is your salary; living costs, car and staff come out of it.
- **Hot deals** are a two-week fast-track (turns are weekly, so "48 hours" becomes "this turn and next").
- **Geography** includes remote cities even in Phase 1, because commercial travel (cost in AP, 2-turn intercontinental
  trips) is in scope. Remote airfield-only HQs stay out until jets.
- **Marks** are last-round post-money (impaired in distress); unrealised positions are valued at 85% in the final score.
- **LP trust** moves with TVPI vs a J-curve expectation and with thesis drift; it feeds the small score bonus now and
  Fund II sizing later.

## Roadmap

- **Phase 2**: fairs (local, regional), rival VC dynamics, crypto sleeve, deeper market regimes.
- **Phase 3**: charter market, fractional shares, jets and co-owners, pilot training.
- **Phase 4**: Fund II+, LP dynamics, accelerator, Hall of Fame.
