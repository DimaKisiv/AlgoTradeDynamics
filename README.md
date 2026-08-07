# AlgoTradeDynamics

Платформа для запуску Grid Bot і Pattern Scalper на Bybit або локальному exchange emulator та для детермінованого тестування **тих самих стратегій** на історичних даних.

Старий окремий MA Crossover / RSI backtester видалено. Нова вкладка **Backtests** бере конфігурацію одного з існуючих ботів, створює її snapshot, запускає приховану тестову копію через той самий trading engine і програє свічки в ізольованому emulator account.

## Сервіси

- `frontend` — React/Vite, `http://localhost:5173`
- `backend` — FastAPI, `http://localhost:8000`
- `exchange-emulator` — Bybit-compatible API та admin API, `http://localhost:8001`
- `db` — PostgreSQL 16

Swagger:

- Backend: `http://localhost:8000/docs`
- Emulator: `http://localhost:8001/docs`

## Запуск

```bash
docker compose up --build
```

Вхід за замовчуванням:

```text
demo@algotrade.dev
demo1234
```

Зупинка без видалення даних:

```bash
docker compose down
```

Повне очищення PostgreSQL та emulator volume:

```bash
docker compose down -v
```

## Важливо при оновленні

Міграція `0008_replace_legacy_backtests` навмисно видаляє таблиці та результати старого MA/RSI backtester-а. Вони несумісні з новими emulator-driven backtests. Міграція `0009_backtest_dataset_id` додає до кожного нового запуску точний `dataset_id` і назву набору.

При звичайному запуску backend автоматично виконує:

```bash
alembic upgrade head
```

## Exchange Emulator

Сторінка `/emulator` підтримує три режими:

1. **Manual** — встановлення конкретної ціни або плавний рух до цілі.
2. **Scenario** — збережені послідовності рухів ціни.
3. **Historical** — replay локально збережених свічок.

Також доступні:

- постійні тестові акаунти;
- баланс, equity, позиції, ордери та executions;
- reset account;
- завантаження історії з Bybit для довільного символу;
- імпорт CSV;
- окремі datasets для різних періодів, джерел та timeframe;
- перевірка кількості свічок, volume, меж покриття та внутрішніх пропусків;
- activity/event log.

Кожне завантаження з Bybit або CSV-імпорт створює **новий незалежний dataset** з власним `dataset_id`. Навіть якщо два набори мають однакові `symbol + interval + timestamps`, їхні свічки не змішуються. Підтримуються `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `12h`, `1D` і `1W`.

Вбудовано денні datasets `BTCUSDT` і `ETHUSDT` за 2024 рік. Для Pattern Scalper зазвичай варто починати з повних `1m`, `5m` або `15m` OHLCV-наборів.

## Типи ботів

### Grid Bot

Існуюча сіткова стратегія: limit-входи нижче поточної ціни, усереднення позиції, один Position TP і перебудова grid після завершення циклу.

### Pattern Scalper

Перша пояснювана версія «розумного» бота. Вона:

- аналізує тільки закриті OHLCV-свічки;
- використовує EMA trend, RSI, ATR, breakout і volume confirmation;
- відкриває LONG або SHORT market-угоду;
- тримає не більше однієї позиції;
- керує stop-loss, take-profit, maximum holding time і cooldown;
- обмежує quantity, notional, risk per trade та daily loss;
- записує signal score, причини входу та indicator snapshot у history/events.

Це rule-based MVP, а не ML-модель. Така база потрібна, щоб спочатку перевірити execution, fees, slippage і risk management, а вже потім навчати модель на коректних результатах.

## Bot Backtesting

### Створення

На `/backtests`:

1. Обрати існуючого Grid Bot або Pattern Scalper.
2. Обрати конкретний dataset. Його interval підставляється автоматично.
3. Вибрати точний початок і кінець у межах dataset до хвилини.
4. Вказати стартовий баланс, fee rate та slippage.
5. Обрати intrabar path:
   - `Conservative / Open → High → Low → Close`;
   - `Open → Low → High → Close`;
   - `Close only`.
6. Обрати поведінку наприкінці:
   - залишити відкриту позицію й порахувати unrealized PnL;
   - примусово закрити за фінальною ціною.

Оригінальний бот, його статус, ордери та звичайний emulator account не змінюються.

### Ізоляція запуску

Для кожного backtest створюються:

- immutable snapshot конфігурації бота;
- точне посилання на один `dataset_id`;
- прихована тестова копія `TradingBot`;
- окремий emulator account;
- account-scoped market price, яка не рухає ціни інших emulator accounts.

Перед запуском backend перевіряє відповідність символу й market category, наявність volume для Pattern Scalper, покриття вибраного проміжку та відсутність пропущених свічок. Усі kline-запити EMA/RSI/ATR/breakout/volume під час тесту прив’язані до того самого dataset, тому інші набори не можуть підмішатися.

Backtest використовує той самий strategy registry, worker tick, exchange adapter, reconciliation і risk logic, що й звичайний бот. Grid зберігає Position TP/cycle rollover, а Pattern Scalper — свої сигнали та керовані виходи.

### Execution model

Кожна історична свічка програється через її intrabar points. Grid runner синхронізує стратегію після fill до стабільного стану. Pattern Scalper виконує tick на кожній simulated point, але формує сигнали лише за вже закритими свічками, без future leakage.

### Керування

Під час виконання доступні:

- progress та simulated time;
- pause;
- resume;
- cancel;
- live price, PnL і оброблені candles.

## Звіт backtest

### Summary

Зберігаються й показуються:

- gross/net realized PnL;
- unrealized та total PnL;
- return і final equity;
- fees;
- closed/winning/losing cycles та win rate;
- best/worst/average cycle;
- час у позиції та частка тестового періоду;
- час у негативному unrealized PnL;
- найдовший негативний період;
- maximum drawdown;
- найдовший drawdown;
- recovery time після максимальної просадки;
- максимальна позиція та notional;
- максимальна використана margin;
- найнижчий available balance;
- максимальна кількість заповнених grid levels;
- фінальна відкрита позиція й ордери.

### Chart

Графік містить:

- історичну ціну;
- placed та filled entries для вибраної стратегії;
- grid Take Profit або scalper SL/TP/timeout exits;
- cancelled orders;
- підсвічені періоди відкритої позиції;
- підсвічені періоди негативного open PnL;
- equity curve;
- drawdown;
- position size;
- available balance;
- zoom-window `1D / 1W / 1M / All`;
- фільтр конкретного trading cycle;
- перехід до графіка з Orders, Executions, Positions або Cycles.

### Детальні вкладки

- `Cycles`
- `Orders`
- `Executions`
- `Positions`
- `Events`
- `Configuration`

Configuration містить snapshot бота, dataset, fee/slippage model, path, timestamps та технічні IDs.

### Compare

У списку можна вибрати 2–5 завершених запусків. Comparison показує:

- normalized equity curves;
- PnL та return;
- drawdown і recovery;
- exposure;
- час у позиції/мінусі;
- fees;
- strategy parameters.

## Основні backend endpoints

```text
GET    /api/backtests/datasets
POST   /api/backtests
GET    /api/backtests
GET    /api/backtests/{id}
GET    /api/backtests/{id}/points
GET    /api/backtests/{id}/cycles
GET    /api/backtests/{id}/orders
GET    /api/backtests/{id}/executions
GET    /api/backtests/{id}/events
POST   /api/backtests/{id}/pause
POST   /api/backtests/{id}/resume
POST   /api/backtests/{id}/cancel
DELETE /api/backtests/{id}
```

## Перевірки

Backend та emulator Python modules перевіряються через `compileall`. Core integration test запускає реальний emulator HTTP service, створює isolated account, програє bundled BTC history і перевіряє, що backtest завершується, записує points/cycles/metrics та не змінює global emulator market.

Frontend використовує React 18, Recharts і Vite. Для production build потрібен доступ до npm registry під час першого `npm ci`; Docker зробить це автоматично у звичайному середовищі.

## Поточні обмеження

- Pattern Scalper є rule-based; ML training і автоматичний пошук патернів по всьому ринку ще не додані;
- історична точність залежить від timeframe та intrabar model;
- OHLC candle не показує справжній порядок trades усередині інтервалу;
- partial fills, funding, spread, order-book imbalance та tick-level market data можна додати окремими етапами;
- background backtest task живе всередині backend process, тому restart backend перериває активний запуск.

### Pattern Scalper quality entry revision 2

Нові та legacy Pattern Scalper bots використовують більш вибірковий entry profile, щоб зменшити churn та fees:

- minimum signal score: `0.85`;
- volume confirmation: `3.0x` від середнього volume;
- EMA trend confirmation обов’язковий;
- breakout confirmation обов’язковий;
- breakout має пройти додатковий `0.05 ATR` buffer;
- volume confirmation обов’язковий;
- cooldown: `15 min`;
- SL/TP залишені `1.2 ATR / 1.8 ATR`, щоб не змішувати entry optimization з exit optimization.

Legacy bots без `strategy_revision` автоматично отримують ці stricter effective settings, але вже більш строгі user values не послаблюються. Backtest snapshot зберігає саме effective settings, тому Configuration відповідає реально використаній логіці.

Scalper backtest Summary також показує окремі TP / SL / Timeout counts і net PnL та average fee per cycle.

## Backtest engines

Historical backtests are strategy-specific:

- `grid` uses the full exchange-emulator replay engine because limit-order fills, grid rebuilds and order lifecycle behavior are part of the strategy.
- `pattern_scalper` uses the fast in-memory historical engine. It loads the selected dataset, calculates the same EMA/RSI/ATR/breakout/volume signal logic locally, simulates market fills with the configured fees and slippage, and persists the same chart/cycle/order/execution result contract without creating an emulator account.

The emulator itself is unchanged and remains available for manual/scenario/historical replay and grid backtests.
