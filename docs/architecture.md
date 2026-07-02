# Архітектура

## Огляд

AlgoTradeDynamics MVP — це **трирівневий веб-застосунок** з чітким розділенням
відповідальностей між UI-шаром, API-шаром і обчислювальним ядром.

```
┌─────────────────────────────┐
│  React SPA  (frontend)      │   Vite + React Router + Recharts
│  · Landing                  │   Framer Motion (анімації)
│  · Dashboard                │
│  · Runs / RunDetail         │
└──────────────┬──────────────┘
               │  HTTPS / JSON
               ▼
┌─────────────────────────────┐
│  FastAPI  (backend)         │   Pydantic v2 валідація
│  api/  ←  schemas/          │
│   │                         │
│   ▼                         │
│  services/ (orchestration)  │
│   │                         │
│   ▼                         │
│  bot_engine/  (pure python) │
│   · indicators              │
│   · strategies (MA, RSI)    │
│   · backtester              │
└──────────────┬──────────────┘
               │  SQLAlchemy ORM
               ▼
┌─────────────────────────────┐
│  PostgreSQL                 │   Alembic для версіонування схеми
│  · backtest_runs            │
│  · trades                   │
│  · equity_points            │
└─────────────────────────────┘
```

## Шари бекенду

### `api/` — HTTP-шар
FastAPI-роутери, які лише приймають payload, делегують у сервіс і повертають response.
Жодної бізнес-логіки тут немає. Обробка `HTTPException` для відомих помилок (404, 422).

### `schemas/` — контракти даних
Pydantic v2 моделі для запитів і відповідей. Тут же валідація меж параметрів
(`fast_window: int = Field(ge=2, le=100)` і т. д.). Сюди ніколи не потрапляють ORM-об'єкти.

### `services/` — оркестрація
Сервісний шар: підвантажує датасет, будує стратегію через factory, запускає backtester,
зберігає результат у БД, повертає ORM-об'єкт. Це єдине місце, де перетинаються БД і
обчислення.

### `bot_engine/` — обчислювальне ядро
Pure-Python модуль, повністю відірваний від HTTP і БД. Складається з:

- `data_loader.py` — `Candle` dataclass + CSV reader
- `indicators.py` — SMA (O(n) sliding window), RSI (Wilder smoothing)
- `strategies/` — абстракція `Strategy` (ABC) + дві реалізації
- `backtester.py` — приймає `Strategy` і `Candle[]`, повертає `BacktestResult` з усіма
  метриками та equity curve. Враховує stop-loss, position sizing і max drawdown halt.

Перевага розділення: бот-двигун можна тестувати unit-тестами без піднімання FastAPI чи БД.

### `models/` — ORM
SQLAlchemy 2.0 з `Mapped[]` синтаксисом. Три таблиці:
- `backtest_runs` — заголовок запуску (метрики, параметри стратегії та ризику в JSON-колонках)
- `trades` — кожна угода (з FK на run)
- `equity_points` — точки equity curve (з FK на run)

`cascade="all, delete-orphan"` гарантує, що видалення run автоматично прибирає всі залежні
записи.

### `db/` — інфраструктура
`base.py` — `DeclarativeBase`. `session.py` — engine + sessionmaker + `get_db()` залежність.

### `core/` — крос-вирізні
- `config.py` — Pydantic Settings, читає `.env`
- `logging.py` — структуроване логування з єдиним форматтером

## Frontend архітектура

### Pages (4)
- `LandingPage` — маркетингова сторінка з Hero / Features / HowItWorks / Strategies / CTA
- `DashboardPage` — головна робоча зона: форма зліва, результати справа
- `RunsPage` — список усіх запусків з можливістю видалення
- `RunDetailPage` — деталі окремого запуску

### Components
- `components/ui/` — примітиви (`Button`, `Card`)
- `components/layout/` — `Navbar` (з scroll-detection), `Footer`
- `components/landing/` — секції лендингу
- `components/dashboard/` — `ControlPanel`, `EquityChart`, `TradeJournal`, `MetricCard`, `ResultsView`

### Автентифікація та розмежування даних
JWT-автентифікація (email + пароль, bcrypt-хеш через `passlib`, токен HS256 через `PyJWT`):

- `POST /api/auth/register` → створює користувача; `POST /api/auth/login` → повертає access-токен;
  `GET /api/auth/me` → поточний користувач. Захищені ендпоінти читають токен через залежність
  `get_current_user` (FastAPI `HTTPBearer`).
- Кожен `BacktestRun` має `user_id` (FK → `users`, `ON DELETE CASCADE`). Сервісний шар фільтрує всі
  вибірки за `user_id`, тож користувач фізично не може отримати чужий запуск (повертається `404`).
- Фронтенд тримає токен у `localStorage`, додає `Authorization: Bearer <token>` до кожного запиту
  (`api/client.js`) і автоматично розлогінює на `401`. Стан сесії — у `AuthContext`; маршрути
  захищає `ProtectedRoute` / `GuestRoute`.
- Міграція `0002` створює `users`, додає `user_id` і засідає демо-користувача `demo@algotrade.dev`.

### State
Локальний state через React hooks. Окремих state-менеджерів немає — MVP того не потребує.

- `useBacktest` — інкапсулює форму, виклик API, помилки, loading-стан
- `useScrollReveal` — IntersectionObserver для fade-up анімацій на скролі

### Стилі
Гібридний підхід: **CSS-модулі** (`Name.module.css`, co-located з кожним компонентом) для локальних
скоупованих стилів + **глобальний шар** у `styles/` — `variables.css` (дизайн-токени в `:root`) і
`globals.css` (reset, типографіка та утиліти-класи: `.container`, `.glass`, `.reveal`, `.eyebrow` тощо).
Vite хешує локальні класи (напр. `_heroInner_cm4rb`), тож колізій імен між компонентами немає; спільні
утиліти лишаються глобальними і застосовуються як звичайні класи. Дизайн-мова:

- Палітра: глибокий navy + emerald accent + coral для збитків
- Типографіка: Instrument Serif (display) + Manrope (body) + JetBrains Mono (цифри)
- Glassmorphism: `backdrop-filter: blur(24px) saturate(160%)` на elevated surfaces
- Atmospheric backdrop: фіксований radial-gradient + SVG grain texture
- Motion: cubic-bezier(0.16, 1, 0.3, 1) для природного easing

## Потік даних: POST /api/backtests/start

```
1. UI (ControlPanel)
   → formData { symbol, strategy, ma_params|rsi_params, risk, initial_balance }
2. fetch POST /api/backtests/start
3. FastAPI: BacktestRequest (Pydantic) валідує payload
4. api/backtests.py → services.run_backtest(db, payload)
5. services:
   a. _resolve_dataset(symbol) → завантажує CSV (data_loader)
   b. get_strategy(strategy, params) → MA або RSI instance
   c. Backtester(strategy, candles, risk_params).run() → BacktestResult
   d. Створює BacktestRun + усі Trades + усі EquityPoints, db.commit()
   e. Повертає run з selectinload(trades, equity_points)
6. FastAPI серіалізує через BacktestRunResponse (Pydantic)
7. UI (ResultsView) рендерить метрики, EquityChart, TradeJournal
```

## Розширюваність

**Додавання нової стратегії:**
1. Створити клас у `bot_engine/strategies/`, успадкований від `Strategy`
2. Імплементувати `generate_signals(candles)` і `to_params_dict()`
3. Зареєструвати у `STRATEGIES` dict + `get_strategy()` factory
4. Додати Pydantic-схему параметрів у `schemas/backtest.py`
5. Додати tab у `ControlPanel/ControlPanel.jsx`

Жодних змін у backtester чи в БД-схемі — стратегії повністю відокремлені.

**Перехід до live trading (поза рамками MVP):**
Замінити `Backtester` на `LiveExecutor` з тим самим контрактом (`Strategy`-споживач). Підключити
WebSocket до біржі (Bybit/Binance через `ccxt`) і transactional виконання ордерів. Це окрема
велика підсистема — у MVP свідомо винесена за рамки.
