# AlgoTradeDynamics prototype v1

> MVP веб-платформи для безпечного backtesting криптовалютних торгових стратегій.
> Дипломна робота · Neoversity MSc Computer Science · 2026

Платформа дозволяє трейдеру налаштувати алгоритмічну стратегію (Moving Average Crossover або
RSI Mean Reversion), запустити її на історичних даних і отримати:

- Equity curve (динаміка капіталу в часі)
- Ключові метрики: Total PnL, Win Rate, Max Drawdown
- Повний журнал умовних угод
- Історію усіх запусків з можливістю порівняння
- Персональний обліковий запис — кожен користувач працює лише зі своїми даними

Платформа містить окремий локальний **Exchange Emulator**. Він приймає Bybit-сумісні
запити від grid-бота, але не відправляє ордери на реальну біржу. Для Bybit Demo/Testnet/Live
залишена окрема конфігурація, яку слід вмикати лише свідомо.

---

## Технологічний стек

| Шар            | Технологія                                                      |
| -------------- | --------------------------------------------------------------- |
| Backend        | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2      |
| База даних     | PostgreSQL 16 (SQLite для локального dev / тестів)              |
| Bot Engine     | Pure Python (без сторонніх trading-бібліотек)                   |
| Frontend       | React 18, Vite 5, React Router 6, Framer Motion, Recharts       |
| Дизайн         | CSS Modules + дизайн-токени, Glassmorphism, Instrument Serif + Manrope |
| Auth           | JWT (PyJWT, HS256) + bcrypt (passlib); приватні дані за `user_id`      |
| Тести          | pytest + httpx TestClient                                       |
| Інфраструктура | Docker, Docker Compose                                          |

## Архітектура

```
algotrade-dynamics/
├── backend/                    # Python FastAPI
│   ├── app/
│   │   ├── api/                # роутери: auth, strategies, backtests (+deps)
│   │   ├── core/               # config, logging, security (JWT + bcrypt)
│   │   ├── db/                 # SQLAlchemy session & base
│   │   ├── models/             # ORM: User, BacktestRun, Trade, EquityPoint
│   │   ├── schemas/            # Pydantic схеми (backtest, user)
│   │   ├── services/           # backtest_service, auth_service
│   │   ├── bot_engine/         # Backtester + стратегії
│   │   │   ├── indicators.py   # SMA, RSI (pure python)
│   │   │   ├── backtester.py   # Engine з risk-менеджментом
│   │   │   └── strategies/     # MA, RSI + ABC base
│   │   └── main.py             # FastAPI app
│   ├── alembic/                # Міграції БД
│   ├── data/                   # CSV історичні дані
│   ├── tests/                  # 30 unit + integration тестів
│   └── Dockerfile
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── api/                # client.js (fetch+токен), auth.js, backtests.js
│   │   ├── context/            # AuthContext (провайдер + useAuth)
│   │   ├── components/         # кожен компонент — окрема папка:
│   │   │   │                   #   Name/Name.jsx + Name/Name.module.css
│   │   │   ├── layout/         # Navbar/ (auth-стан), Footer/
│   │   │   ├── ui/             # Button/, Card/
│   │   │   ├── landing/        # Hero/, Features/, HowItWorks/, Strategies/, CTA/
│   │   │   ├── dashboard/      # ControlPanel/, EquityChart/, TradeJournal/, MetricCard/, ResultsView/
│   │   │   └── routing/        # ProtectedRoute, GuestRoute
│   │   ├── pages/              # Landing/Dashboard/Runs/RunDetail + Login/Register/Account
│   │   ├── hooks/              # useBacktest, useScrollReveal
│   │   ├── lib/                # Форматери
│   │   ├── styles/             # глобальний шар: variables.css (токени) + globals.css (reset, типографіка, утиліти)
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── Dockerfile
├── docs/                       # Архітектура, demo-script, scope
└── docker-compose.yml
```

## Швидкий старт (Docker — рекомендований шлях)

Передумови: Docker Desktop / Docker Engine + Docker Compose v2.

```bash
docker compose up --build
```

Після успішного старту:

- **Frontend (SPA):** http://localhost:5173
- **Backend (API):** http://localhost:8000
- **Swagger UI:** http://localhost:8000/docs
- **Exchange Emulator API / Swagger:** http://localhost:8001/docs
- **PostgreSQL:** localhost:5432 (user `postgres` / db `algotrade`)

Alembic міграції виконуються автоматично при старті backend-контейнера.


## Exchange Emulator

Після `docker compose up --build` відкрийте frontend, увійдіть і перейдіть у
**Emulator** (`/emulator`). Сервіс біржі працює окремо на `http://localhost:8001`,
а його SQLite-база зберігається в Docker volume `emulator_data`.

### Що реалізовано

- постійні тестові акаунти з API key, балансом, equity та available balance;
- Bybit-сумісні endpoints для ticker, instrument info, create/cancel/query orders,
  order history, positions, wallet balance, executions і leverage;
- повне виконання limit/market ордерів, reduce-only закриття, average entry,
  realized/unrealized PnL та maker/taker fees;
- режими **Manual**, **Scenario** та **Historical Replay**;
- завантаження OHLCV через публічний Bybit Kline API;
- автоматично підготовлені bundled daily datasets BTCUSDT та ETHUSDT за 2024 рік;
- імпорт CSV з колонками `date|timestamp|open_time, open, high, low, close, volume`;
- журнал подій, orders, positions та executions;
- вибір emulator-акаунта безпосередньо у формі створення бота.

### Перший тест бота

1. Відкрийте `/emulator` → **Accounts**. Можна використати `Default Emulator Account`
   з балансом 10,000 USDT або створити новий.
2. Відкрийте `/bots` і створіть бота:
   - Environment: `Local Emulator`;
   - Emulator account: потрібний тестовий акаунт;
   - Symbol: наприклад `ETHUSDT`;
   - Order Qty: наприклад `0.01`;
   - Grid Orders: `2`;
   - Grid Step: `5`.
3. Натисніть **Start**. Worker створить grid-ордери через локальний Bybit-compatible API.
4. Поверніться в `/emulator` → **Manual** і зменште ціну. Ордери, позиція та PnL
   з'являться у вкладці **Activity**.
5. Підніміть ціну вище take-profit, щоб перевірити закриття циклу.
6. Перед новим незалежним тестом натисніть **Reset account**.

### Historical Replay

1. У вкладці **Historical** виберіть symbol, діапазон дат та interval.
2. Натисніть **Download from Bybit** або імпортуйте CSV.
3. Виберіть швидкість та intrabar path:
   - `Open → High → Low → Close`;
   - `Open → Low → High → Close`;
   - `Close only`.
4. Використовуйте **Start / Pause / Resume / Next candle / Stop**.

`speed` означає кількість свічок за секунду, а не реальний часовий масштаб.
Для повторюваних тестів використовуйте той самий акаунт після reset або окремий акаунт.

### Сервіси Docker Compose

```text
frontend          http://localhost:5173
backend           http://localhost:8000
exchange-emulator http://localhost:8001
postgres          localhost:5432
```

### Тести емулятора

```bash
cd EXCHANGE_EMULATOR
pip install -r requirements.txt
PYTHONPATH=. pytest -q
```

## Локальний запуск без Docker

### Backend

```bash
cd BE
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # за потреби відредагуйте
# для локалки можна залишити sqlite:///./algotrade.db у DATABASE_URL
alembic upgrade head              # якщо використовуєте Postgres
uvicorn app.main:app --reload
```

### Frontend

У новому терміналі:

```bash
cd FE
cp .env.example .env
npm install
npm run dev
```

## Тестування

```bash
cd BE
pytest -v
```

Покриває: indicators (SMA, RSI), обидві стратегії, backtester (entry/exit, stop-loss,
drawdown halt), HTTP API (POST/GET/DELETE, validation errors), автентифікацію
(register / login / me) та ізоляцію даних між користувачами.

Кількість тестів може змінюватися разом із функціональністю; усі тести мають завершитися без помилок.

## API стисло

| Метод  | Шлях                   | Опис                                      |
| ------ | ---------------------- | ----------------------------------------- |
| GET    | `/health`              | Healthcheck                               |
| POST   | `/api/auth/register`   | Реєстрація (email + пароль)               |
| POST   | `/api/auth/login`      | Логін, повертає JWT access token          |
| GET    | `/api/auth/me` 🔒       | Поточний користувач + к-сть його запусків |
| GET    | `/api/strategies`      | Каталог доступних стратегій з параметрами |
| POST   | `/api/backtests/start` 🔒 | Запустити backtest, повернути результат |
| GET    | `/api/backtests` 🔒     | Список **своїх** запусків (summary)       |
| GET    | `/api/backtests/{id}` 🔒 | Деталі свого запуску (trades + equity)   |
| DELETE | `/api/backtests/{id}` 🔒 | Видалити свій запуск                     |

🔒 — потребує заголовок `Authorization: Bearer <token>`.

Повна інтерактивна документація — `http://localhost:8000/docs` (Swagger UI).

Більше — у `docs/`:

- `docs/architecture.md` — діаграма компонентів і потоків
- `docs/demo-script.md` — сценарій для демо на захисті
- `docs/project-scope.md` — обмеження MVP та подальший розвиток

## Автентифікація та облікові записи

Платформа багатокористувацька: кожен користувач бачить і керує лише **своїми**
backtest-сесіями.

- **Автентифікація** — email + пароль. Пароль зберігається як bcrypt-хеш (`passlib`),
  ніколи у відкритому вигляді. Після логіну сервер видає **JWT** (HS256, `PyJWT`),
  який фронтенд додає у заголовок `Authorization: Bearer <token>`.
- **Авторизація (доступ до даних)** — кожен `BacktestRun` прив'язаний до `user_id`.
  Усі запити (створення, список, деталі, видалення) фільтруються за поточним
  користувачем; чужий запуск повертає `404`. Ролей/дозволів немає — модель проста:
  «кожен бачить лише своє».
- **Токен** зберігається у `localStorage`; на будь-яку відповідь `401` фронтенд
  автоматично розлогінює користувача й пропонує увійти знову.

Міграція `0002` створює таблицю `users`, додає `user_id` до `backtest_runs`
і засідає **демо-користувача** для швидкого старту:

```
email:    demo@algotrade.dev
password: demo1234
```

Налаштування через env: `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
(див. `.env.example`). У продакшені обов'язково задайте власний `JWT_SECRET_KEY`.

Фронтенд-маршрути: `/login`, `/register` (лише для гостей), `/account`, а також
`/app`, `/runs`, `/runs/:id` — захищені (редірект на `/login`, якщо не залогінений).

## Безпека та обмеження

Це навчальний MVP. **Жодних реальних ордерів в emulator-режимі не виконується.** Ціни можуть
задаватися вручну, сценарієм або історичними свічками; вся emulator-торгівля — умовна симуляція. Платформа не призначена для прийняття інвестиційних рішень
без додаткового аналізу.


## Правила формування Git Braches
Для забезпечення єдиного підходу до роботи з Git усі гілки повинні створюватися відповідно до визначеного формату.

Назва гілки повинна:
- бути написана англійською мовою;
- використовувати kebab-case;
- містити короткий і зрозумілий опис задачі;
- не містити пробілів;
- бути написана в нижньому регістрі.

Типи гілок

feature
Використовується для розробки нової функціональності.
personal/ia/feature/user-authentication
personal/ia/feature/trading-dashboard
personal/ia/feature/add-user-profile

bugfix
Використовується для виправлення конкретного багу, виявленого під час тестування або роботи системи.
personal/ia/bugfix/incorrect-trading-price
personal/ia/bugfix/chart-not-rendering

refactor
Використовується для зміни структури або покращення коду без зміни функціональності.
personal/ia/refactor/api-client
personal/ia/refactor/auth-service
personal/ia/refactor/trading-module

test
Використовується для додавання або оновлення тестів.
personal/ia/test/add-login-tests
personal/ia/test/update-trading-tests

Правило
Кожна задача повинна виконуватися в окремій гілці. Після завершення роботи створюється Pull Request / Merge Request у main.

Не рекомендується використовувати назви:
test
new-feature
my-branch
fix
temp
dev
illia

Приклад формування гілок:
personal/перша літера імʼя та прізвища у моєму варіанті це ia, далі тип гілки (feature, bugfix, refactor, test) і 
короткий опис задачі у форматі kebab-case.

# Pull Request Rules

1. **Один PR — одна задача.** Не об'єднувати різні функціональні зміни в один PR.

2. **Зрозуміла назва PR.** Назва повинна коротко описувати внесені зміни та, за можливості, містити ID задачі.

   ```text
   [FE] Add trading dashboard
   [BE] Add trading functionality
   ```

3. **PR повинен містити опис.** Коротко вказати, що було змінено та як це протестовано.

4. **Перед створенням PR перевірити код.**

  * Lint проходить успішно.
  * Тести проходять успішно.
  * Build проходить успішно.
  * Немає debug-коду або випадкових змін.

5. **Code Review обов'язковий.** PR повинен отримати щонайменше 1 Approval перед merge.

6. **Усі критичні коментарі повинні бути вирішені** перед merge.

7. **Не виконувати прямий push у `main`.** Зміни потрапляють у `main` тільки через Pull Request.

8. **Після merge видалити branch**, якщо вона більше не використовується.

