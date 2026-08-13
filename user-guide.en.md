# AlgoTradeDynamics User Guide

**How to watch a trading bot work without risking your own money**

MVP version · 2026 · [English version](user-guide.en.md)

---

## Contents

- [1. What this is and why it exists](#1-what-this-is-and-why-it-exists)
- [2. The key point: this is not "buying crypto"](#2-the-key-point-this-is-not-buying-crypto)
- [3. Signing in](#3-signing-in)
- [4. First experiment: a Grid Bot in ten minutes](#4-first-experiment-a-grid-bot-in-ten-minutes)
- [5. What you just saw: the terms explained](#5-what-you-just-saw-the-terms-explained)
- [6. Second experiment: a scenario instead of manual clicks](#6-second-experiment-a-scenario-instead-of-manual-clicks)
- [7. Third experiment: a test on real history](#7-third-experiment-a-test-on-real-history)
- [8. Pattern Scalper: the bot that waits for its moment](#8-pattern-scalper-the-bot-that-waits-for-its-moment)
- [9. Reading the results without fooling yourself](#9-reading-the-results-without-fooling-yourself)
- [10. The bot is doing nothing — what to check](#10-the-bot-is-doing-nothing--what-to-check)
- [11. Limits of the platform, and safety](#11-limits-of-the-platform-and-safety)
- [12. Where to go next](#12-where-to-go-next)

---

## 1. What this is and why it exists

If you have ever bought cryptocurrency and held it in a wallet, you already know one strategy: buy and wait. AlgoTradeDynamics shows you what comes after that — what trading looks like when the decisions are made by a program following rules set in advance.

The platform does not make money. It gives you a safe place to see a trading bot from the inside: which orders it places, when and why it opens a position, how much the fees eat, and how deep the balance can sink. All of it on virtual money.

The key piece is the built-in **exchange emulator**. It is a program that behaves almost like the real Bybit, but runs locally and operates on an imaginary balance. You control the price yourself — you can crash the market by 20 % by hand and watch what the bot does. No real exchange lets you order that experiment.

In the 20–30 minutes this guide takes, you will start your first bot, see its orders, push the price to the level you need and close a trade in profit. Then you will do the same thing on real historical data.

---

## 2. The key point: this is not "buying crypto"

This is the one part of the guide worth reading carefully before you click anything. Everything after it is easier.

When you bought Bitcoin and held it, you **owned the coin**. Your balance _was_ the Bitcoin. Here it works differently: the bots trade perpetual contracts (_linear perpetuals_). A perpetual is an agreement about a price difference. You never receive the coin — you agree with the exchange that you take the difference if the price moves your way, and pay it if it moves against you.

Three consequences follow that did not exist when you simply held coins.

**You can profit from a falling market.** A LONG position bets on a rise, a SHORT bets on a fall. For someone holding coins, the second option simply does not exist.

**The position is larger than your money.** By default the emulator gives ten times leverage. A position worth 65 USDT requires only about 6.5 USDT of margin. That is convenient for testing, but it means both profit and loss are calculated on the full position size, not on the margin.

**A position can be lost entirely.** If the market moves against you far enough, the exchange closes the position by force — that is _liquidation_. Coins in a wallet do not disappear that way; a contract can.

> This is exactly why the emulator is worth having: everything above is better seen once on imaginary money than discovered on your own.

---

## 3. Signing in

Open the platform at the address you were given and sign in with the ready-made demo account:

```
Email:    demo@algotrade.dev
Password: demo1234
```

If you are running the system on your own machine, the startup commands and the addresses you need are in the project README.

---

## 4. First experiment: a Grid Bot in ten minutes

The Grid Bot is the easiest one to understand. Its idea is mundane: place several buy orders below the current price and wait. If the market dips, the bot has bought cheaper. When the price comes back, it sells everything together at a small profit and starts over.

You are about to do this by hand: you will drop the price yourself, watch the orders fill, push it back up and watch the trade close.

### Step 1. Prepare a test account

Open the **Emulator** section, **Accounts** tab. A `Default Emulator Account` is already there with a balance of 10,000 virtual USDT. If you have experimented before, press **Reset account** to return it to its initial state.

Each such account has its own API key. It is a key to the local emulator only: it has no access to a real exchange or to real money.

### Step 2. Set the starting price

Go to the **Manual** tab, select the `BTCUSDT` pair and set the price to `65000`. The notation BTCUSDT means "how many USDT one Bitcoin costs", so a price of 65,000 is 65,000 USDT per coin.

### Step 3. Create the bot

Go to **Bots** → **Create bot**. Enter these parameters:

```
Name:              Beginner BTC Grid
Environment:       Local Emulator
Strategy:          Grid Bot
Category:          Linear
Symbol:            BTCUSDT
Order Qty:         0.001
Grid Orders Count: 2
Grid Step:         5
Bot active:        enabled
```

`Environment` must always be **Local Emulator**. Bybit Live mode is blocked by default in the system, and you do not need it for learning.

`Order Qty` 0.001 means 0.001 Bitcoin per order — about 65 USDT of position value at our price. `Grid Orders Count` 2 means two buy levels, and `Grid Step` 5 sets the distance between them at 5 %.

### Step 4. Start it and look at what appeared

Press **Start**, then **Open** to open the bot page. You will see two buy orders: one near 65,000 and one near 61,750 (exactly 5 % lower). They have not filled yet — these are _limit_ orders, meaning "buy if the price reaches here".

### Step 5. Crash the market

Go back to **Emulator → Manual** and set the price to `61750`. Now open the bot page again. Both orders filled and a position appeared: you hold 0.002 BTC at an average entry price of roughly 63,375 — the average of the two purchases.

The bot immediately placed a single take-profit order for the whole position, about 1.5 % above the average price, so around 64,325.

### Step 6. Push the price up and close the trade

In **Manual**, set `64500`. The price crossed the take-profit level, the position closed, a completed trading cycle appeared, and the summary shows a profit. After that the bot automatically started a new cycle and laid out the grid again.

> You have just gone through a full trading cycle: orders → fills → position → profit taken → new cycle. Every other feature of the platform is just a different way of running that same cycle: by scenario, on history, with another strategy.

### Variation: DCA Bot

Next to Grid Bot in the strategy list there is a **DCA Bot**. The mechanics are the same — averaging plus one take-profit for the whole position — with two differences that are easy to see in the same manual experiment:

1. **It enters immediately.** A Grid Bot waits for the price to fall to its first order. A DCA Bot buys the base quantity with a market order the moment it starts, and places its safety orders below.
2. **The orders are uneven.** Every next safety order sits further from the entry price (the step is multiplied by the "step multiplier") and buys more (the quantity is multiplied by the "volume multiplier"). A deep drawdown therefore pulls the average price down harder — but also demands a much larger deposit.

Try it: create a DCA Bot with base quantity `0.001`, two safety orders, first step `3`, multipliers `1.5` and `1.3`. Right after the start you will hold 0.001 BTC with a take-profit above the entry and two orders below — at 3 % (quantity 0.0015) and at 6.9 % (quantity ~0.002 after rounding). Crash the price and watch the take-profit slide down after the average price on every averaging fill.

> A note on risk: the double advantage of DCA (instant entry + growing buys) is also its double risk. Add up the whole ladder — that is exactly how much the bot will hold in the worst case, when the price falls and does not come back.

---

## 5. What you just saw: the terms explained

The terms make more sense now, because each one refers to something that already happened on your screen.

| Term                        | What it means in practice                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Order**                   | A request to the exchange to buy or sell. A _limit_ order only triggers at the price you named — these are what the Grid Bot places. A _market_ order executes immediately at the current price. |
| **Position**                | What appeared once the orders filled: how many coins, at what average price, and with what current result.                                                                                       |
| **Average entry price**     | Your 63,375 — the average of two purchases at 65,000 and 61,750. Profit is measured from it.                                                                                                     |
| **Take-profit (TP)**        | The level at which profit is taken automatically. It was the order that closed your position in step 6.                                                                                          |
| **Stop-loss (SL)**          | The mirror level: it closes the position so the loss stops growing. The Grid Bot does not use one; the Pattern Scalper does.                                                                     |
| **PnL**                     | Profit or loss. _Realized_ is already locked in on closed trades; _unrealized_ is the current result of an open position and will still change.                                                  |
| **Wallet balance / Equity** | Balance is the money in the account. Equity is the balance plus the current result of open positions — what the account is really worth right now.                                               |
| **Drawdown**                | How far equity has fallen from its own peak. Rose to 11,000, dropped to 9,900 — a drawdown of about 10 %.                                                                                        |
| **Fee**                     | What the exchange charges on every trade. It looks tiny, but it eats the profit when there are many trades and each one earns little.                                                            |
| **Slippage**                | A market order filled slightly worse than expected: you wanted 65,000 and got 65,013. On a real market this is normal.                                                                           |

---

## 6. Second experiment: a scenario instead of manual clicks

Moving the price by hand every time is tedious. The **Scenario** tab lets you record a sequence of moves once and then replay it as many times as you like.

A scenario is a list of steps, each naming a price and the time it takes to get there. For example:

```
1. 65000  (start)
2. 60000  over 10 seconds   ← crash
3. 68000  over 15 seconds   ← recovery
```

The **Start**, **Step** and **Restart** buttons run the scenario in full, one step at a time, or from the beginning. Ready-made examples ship with the project: a dip with a recovery, a sharp market crash, and one that fills every grid level.

This is the main tool when you have changed a bot's settings and want an honest comparison: the same scenario means the same conditions for both versions.

---

## 7. Third experiment: a test on real history

Manual moves and scenarios are invented situations. **Backtest** shows what the bot would have done at real historical prices.

An important property of the platform: the test runs **the same code** that runs in a live bot. The system makes a copy of the settings, a separate test account and a separate history — your original bot is not modified.

### Where the data comes from

Historical candles are called a **dataset**. Daily BTCUSDT and ETHUSDT data for 2024 ships with the project, which is enough for the Grid Bot. You can load your own on the **Emulator → Historical** tab by specifying the pair, period and candle interval, or import one from a CSV file.

A _candle_ is the price movement over a period of time: the open, the high, the low, the close and the traded volume. A _timeframe_ is the length of a single candle: `5m` is five minutes, `1h` an hour, `1D` a day.

### How to run a test

1. Open the **Backtests** section and press **New backtest**.
2. Choose a bot and a dataset — the system only offers datasets that match by pair and category.
3. Set the starting balance (10,000 works well for a first run) and a period inside the available data.
4. Leave `Execution path` on **Conservative**.
5. Leave `Fee rate` at `0.0002` — that is 0.02 %, the standard Bybit fee.
6. Start it and watch the progress; a test can be paused, resumed or cancelled.

### Why Execution path exists at all

A historical candle stores only four prices and does not remember the order in which the market visited them. If within one candle the price reached both a buy level and a take-profit level, the outcome depends on which came first.

The **Conservative** option assumes the least favourable order for a grid: high first, then low. It is deliberately pessimistic, and that is exactly what makes it more honest. The **Close only** option looks at the closing price alone and may miss orders entirely that would have filled inside the candle.

> Always add a little slippage, say 0.02–0.05 %, when you are testing seriously. With zero, the result will look better than reality ever is.

---

## 8. Pattern Scalper: the bot that waits for its moment

The Grid Bot does not think about market direction — it places orders and waits. The Pattern Scalper works differently: most of the time it does nothing, and it opens a position only when the chart forms the picture it is looking for.

This is **not** artificial intelligence and not machine learning. The bot checks five conditions, each of which adds points to an overall signal score:

- **trend direction** — whether the fast moving average is above or below the slow one;
- **breakout** — whether the candle closed above a recent high (or below a recent low);
- **volume** — whether it exceeds the average, since a move on high volume is more reliable;
- **RSI** — whether the indicator confirms the strength of the move without showing it is overheated;
- **candle range** — whether the move was decisive enough.

But points alone are not enough. Three of the conditions — trend, breakout and volume — are **mandatory**: if even one of them fails, there is no entry at any score. Only when all three are confirmed and the score reaches the threshold (`0.85` by default, i.e. 85 %) does the bot open a position. For every entry it stores the list of conditions that fired, so the **Events** tab shows not just that a trade happened but why.

On top of that, a breakout has to exceed the recent extreme by a margin (0.05 ATR), and the candle body must be at least 0.25 ATR. Both checks filter out borderline entries where the move is too weak to cover the fee.

> **Why these thresholds.** In the first version of the strategy the score threshold was `0.70` and the volume multiplier `1.2`. A full-year test on BTC showed that the logic came out close to zero even before fees, and that the sheer number of weak entries made fees the dominant cost. The second version therefore tightened the requirements. One detail matters: if you enter values looser than these (a score of `0.70`, say), the system raises them to the safe minimum — this is not an interface bug. Values stricter than the defaults are kept as you set them.

Once in a position, four safeguards manage it: a stop-loss and a take-profit derived from current market volatility; a maximum holding time (30 minutes by default); a cooldown after each exit (15 minutes); and a daily loss limit (2 %), after which the bot stops entering for the rest of the day.

### Main settings

| Parameter              | Start with | What it changes                                                                                                                             |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Timeframe`            | `5m`       | Candle length. Shorter means more signals but also more random noise.                                                                       |
| `Minimum signal score` | `0.85`     | The quality bar for a signal. Higher means fewer trades and stricter selection. You cannot go below `0.85` — the system will raise it back. |
| `Volume multiplier`    | `3.0`      | How many times above average the volume must be. This one has a floor too.                                                                  |
| `Cooldown`             | `15 min`   | The pause after an exit before the bot looks for the next signal.                                                                           |
| `Stop-loss ATR`        | `1.2`      | How far the stop sits. Larger lets the position ride out swings, but the loss is larger too.                                                |
| `Take-profit ATR`      | `1.8`      | How far the target sits. By default it is further away than the stop.                                                                       |
| `Max holding`          | `30 min`   | The time after which the position is closed even if neither stop nor target was hit.                                                        |
| `Risk per trade`       | `0.5 %`    | How much capital is at risk in a single trade. Because of it the real size may be smaller than Order Qty.                                   |
| `Allow SHORT`          | off        | Leave it off while you are getting acquainted — the logic is easier to follow.                                                              |

> The Pattern Scalper cannot be tested properly by moving the price by hand: it needs candle history, a trend and volume. Test it only through **Backtest**, and make sure the bot's timeframe matches the dataset's. It needs finer candles — `1m`, `5m` or `15m`; the bundled daily data will not do.

---

## 9. Reading the results without fooling yourself

After a test the system shows dozens of numbers. These are the ones that actually decide whether a strategy is any good.

**Net Total PnL** — profit after fees. Look at this one, not at Gross: the gap between them shows how much the costs took.

**Maximum Drawdown** — the deepest fall of the balance across the whole test. This is the main risk measure: a strategy with 5 % profit and a 40 % drawdown is dangerous even though the bottom line is positive.

**Worst Cycle** — the single worst trade. It shows how much it hurts when luck runs out.

**Win Rate** — the share of profitable cycles. The most misleading number of all: 90 % winners are worth nothing if one loser wipes them out. Read it only next to Worst Cycle and the drawdown.

**Max DD Recovery** — how long it took to climb back out of the deepest drawdown. If the recovery never happened before the test ended, the system reports that separately.

For the Pattern Scalper there are four more numbers that explain _why_ the result came out as it did. Cycles are broken down by exit reason — **Take profit**, **Stop loss**, **Timeout** — with both a count and a net PnL for each group. That answers a question the overall total cannot: is the strategy losing on stops, or slowly bleeding out on trades closed by the clock? Next to it is **Average fee per cycle**. Compare it with the average profit per trade: if the two are of the same order, the strategy is working for the exchange, not for you. It was exactly this calculation that led to the tighter entry thresholds in the second version of the scalper.

Runs are best compared on the **Compare** page, where you can select between two and five finished tests. The rule that matters: **change one parameter at a time**. Otherwise there is no way to tell what caused the difference.

```
test 1: Grid Step 3 %
test 2: Grid Step 5 %
test 3: Grid Step 8 %
```

---

## 10. The bot is doing nothing — what to check

The most common situation in the first few days. Work down the list from the top.

| What to check                   | Explanation                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Is the bot started?             | The status should be `Running` or `Waiting for signal`. Also check that `Bot active` is enabled.           |
| Has the price reached an order? | The Grid Bot waits for the market to come down to its limit order. Without price movement nothing happens. |
| Is there simply no signal?      | For the Pattern Scalper this is the normal state. It is not supposed to trade on every candle.             |
| Do the timeframes match?        | A bot on `5m` will not work with a `1h` dataset.                                                           |
| Does the data have volume?      | Without volume the Pattern Scalper cannot check one of its five entry conditions.                          |
| Does the data have gaps?        | The system may refuse to run a test over an incomplete period. Dataset quality is shown next to it.        |
| Did a risk limit trigger?       | The log will show a `Risk Blocked` status or a daily loss limit message.                                   |
| Is the order too small?         | Both the exchange and the emulator enforce a minimum order size.                                           |

One thing worth knowing about the control buttons: **Stop bot** halts the automation but does **not** close an open position. **Cancel all orders** cancels the orders — also without closing the position. To actually leave the market you need **Close position**.

---

## 11. Limits of the platform, and safety

This is an educational MVP, and knowing its limits honestly matters more than trusting nice-looking numbers.

- The exchange model is simplified: there is no order book and no spread, an order fills in full, and slippage is a fixed percentage that does not depend on size.
- A historical candle does not preserve the order of trades inside it, so the result depends in part on the `Execution path` you chose.
- Perpetual funding is not modelled.
- Restarting the backend interrupts a running test.
- Profit on history promises nothing about the future — that is the fundamental limit of any backtest, not just this platform's.

On safety there is one rule: for learning, use **Local Emulator** only. There is no need to enter keys from a real exchange account.

If you ever do connect a real exchange: keys must never be published or stored in an open repository, they must not carry withdrawal permission, and live trading should stay blocked until the strategy has been fully checked on the emulator and on a demo account.

---

## 12. Where to go next

The order that causes the least confusion:

1. **Grid Bot with manual price changes** — understand orders, positions and take-profit ([section 4](#4-first-experiment-a-grid-bot-in-ten-minutes)).
2. **The same bot inside a scenario** of a dip and recovery — see the full cycle without manual clicks.
3. **A Grid Bot backtest** on the bundled daily data — learn to read the chart and the drawdown.
4. **Three runs with different Grid Step values**, then compare them — feel how one parameter changes the result.
5. **Pattern Scalper** on five-minute data with SHORT disabled — study the entry reasons on the Events tab.
6. **The same test with slippage added** — see what execution actually costs.

The point of the platform is not to promise easy money, but to show what automated trading looks like from the inside, what risks hide in it, and how to test a bot while mistakes are still free.

## Compliance / GDPR / Operations

The **Compliance** page exposes the EU reference jurisdiction, retention matrix, EU/EEA hosting target, backup/RPO/RTO policy, third-party services, operations logs, and the incident register. The immutable financial ledger remains available through **Audit Trail**.

Under **Account → GDPR / Privacy**, the user can download a JSON export of their related data or delete the account after password confirmation. Operational/profile data is deleted, while regulatory audit records may remain until the configured retention period expires.

Local backup helpers are provided as `scripts/backup-postgres.ps1` (Windows PowerShell) and `scripts/backup-postgres.sh` (shell). A production scheduler/hosting provider must still enforce the actual backup cadence.
