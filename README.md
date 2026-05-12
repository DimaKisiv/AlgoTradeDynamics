# AlgoTradeDynamics prototype v1

> MVP веб-платформи для безпечного backtesting криптовалютних торгових стратегій.
> Дипломна робота · Neoversity MSc Computer Science · 2025

Платформа дозволяє трейдеру налаштувати алгоритмічну стратегію (Moving Average Crossover або
RSI Mean Reversion), запустити її на історичних даних і отримати:

- Equity curve (динаміка капіталу в часі)
- Ключові метрики: Total PnL, Win Rate, Max Drawdown
- Повний журнал умовних угод
- Історію усіх запусків з можливістю порівняння

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
| Дизайн         | Glassmorphism, custom CSS variables, Instrument Serif + Manrope |
| Тести          | pytest + httpx TestClient                                       |
| Інфраструктура | Docker, Docker Compose                                          |

## Архітектура

```
algotrade-dynamics/
├── backend/                    # Python FastAPI
│   ├── app/
│   │   ├── api/                # HTTP endpoints (FastAPI routers)
│   │   ├── core/               # Config + logging
│   │   ├── db/                 # SQLAlchemy session & base
│   │   ├── models/             # ORM models
│   │   ├── schemas/            # Pydantic схеми
│   │   ├── services/           # Бізнес-логіка
│   │   ├── bot_engine/         # Backtester + стратегії
│   │   │   ├── indicators.py   # SMA, RSI (pure python)
│   │   │   ├── backtester.py   # Engine з risk-менеджментом
│   │   │   └── strategies/     # MA, RSI + ABC base
│   │   └── main.py             # FastAPI app
│   ├── alembic/                # Міграції БД
│   ├── data/                   # CSV історичні дані
│   ├── tests/                  # 21 unit + integration test
│   └── Dockerfile
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── api/                # API клієнт
│   │   ├── components/
│   │   │   ├── layout/         # Navbar, Footer
│   │   │   ├── ui/             # Button, Card
│   │   │   ├── landing/        # Hero, Features, ...
│   │   │   └── dashboard/      # ControlPanel, EquityChart, ...
│   │   ├── pages/              # Landing, Dashboard, Runs, RunDetail
│   │   ├── hooks/              # useBacktest, useScrollReveal
│   │   ├── lib/                # Форматери
│   │   ├── styles/             # CSS variables + globals
│   │   └── App.jsx
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
drawdown halt), HTTP API (POST/GET/DELETE, validation errors).

Очікуваний результат: **21 passed**.

## API стисло

| Метод  | Шлях                   | Опис                                      |
| ------ | ---------------------- | ----------------------------------------- |
| GET    | `/health`              | Healthcheck                               |
| GET    | `/api/strategies`      | Каталог доступних стратегій з параметрами |
| POST   | `/api/backtests/start` | Запустити backtest, повернути результат   |
| GET    | `/api/backtests`       | Список усіх запусків (summary)            |
| GET    | `/api/backtests/{id}`  | Деталі запуску (trades + equity points)   |
| DELETE | `/api/backtests/{id}`  | Видалити запуск                           |

Повна інтерактивна документація — `http://localhost:8000/docs` (Swagger UI).

Більше — у `docs/`:

- `docs/architecture.md` — діаграма компонентів і потоків
- `docs/demo-script.md` — сценарій для демо на захисті
- `docs/project-scope.md` — обмеження MVP та подальший розвиток

## Безпека та обмеження

Це навчальний MVP. **Жодних реальних ордерів не виконується.** Усі ціни — історичні; вся
торгівля — умовна симуляція. Платформа не призначена для прийняття інвестиційних рішень
без додаткового аналізу.
