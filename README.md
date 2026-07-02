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

Симуляція використовує реальні історичні OHLCV-дані. **Жодних реальних ордерів** і жодних
підключень до бірж — це навчальний backtester.

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
- **PostgreSQL:** localhost:5432 (user `postgres` / db `algotrade`)

Alembic міграції виконуються автоматично при старті backend-контейнера.

## Локальний запуск без Docker

### Backend

```bash
cd backend
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
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Тестування

```bash
cd backend
pytest -v
```

Покриває: indicators (SMA, RSI), обидві стратегії, backtester (entry/exit, stop-loss,
drawdown halt), HTTP API (POST/GET/DELETE, validation errors), автентифікацію
(register / login / me) та ізоляцію даних між користувачами.

Очікуваний результат: **30 passed**.

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

Це навчальний MVP. **Жодних реальних ордерів не виконується.** Усі ціни — історичні; вся
торгівля — умовна симуляція. Платформа не призначена для прийняття інвестиційних рішень
без додаткового аналізу.
