# AlgoTradeDynamics

Платформа для запуску grid-ботів на Bybit або локальному exchange emulator та для детермінованого тестування **тих самих ботів** на історичних даних.

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

Міграція `0008_replace_legacy_backtests` навмисно видаляє таблиці та результати старого MA/RSI backtester-а. Вони несумісні з новими emulator-driven backtests.

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
- завантаження історії з Bybit;
- імпорт CSV;
- activity/event log.

Вбудовано денні datasets `BTCUSDT` і `ETHUSDT` за 2024 рік. Для точнішого тесту grid-бота рекомендується завантажити `1m` свічки в `Emulator → Historical`.

## Новий Bot Backtesting

### Створення

На `/backtests`:

1. Обрати існуючого grid-бота.
2. Обрати dataset, interval і період.
3. Вказати стартовий баланс, fee rate та slippage.
4. Обрати intrabar path:
   - `Conservative / Open → High → Low → Close`;
   - `Open → Low → High → Close`;
   - `Close only`.
5. Обрати поведінку наприкінці:
   - залишити відкриту позицію й порахувати unrealized PnL;
   - примусово закрити за фінальною ціною.

Оригінальний бот, його статус, ордери та звичайний emulator account не змінюються.

### Ізоляція запуску

Для кожного backtest створюються:

- immutable snapshot конфігурації бота;
- прихована тестова копія `TradingBot`;
- окремий emulator account;
- account-scoped market price, яка не рухає ціни інших emulator accounts.

Backtest використовує той самий `tick_grid_bot`, reconciliation, lifecycle ордерів, Position TP та cycle rollover, що й звичайний бот.

### Execution model

Кожна історична свічка програється через її intrabar points. Після fill runner синхронізує бота до стабільного стану перед наступним рухом ціни. Це дозволяє створити або оновити TP всередині тієї ж свічки без очікування звичайного worker interval.

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
- placed та filled grid entries;
- створені та виконані Take Profit;
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
- grid parameters.

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

- backtest runner наразі підтримує grid strategy;
- історична точність залежить від timeframe та intrabar model;
- OHLC candle не показує справжній порядок trades усередині інтервалу;
- partial fills, funding та повний order book model можна додати окремими етапами;
- background backtest task живе всередині backend process, тому restart backend перериває активний запуск.
