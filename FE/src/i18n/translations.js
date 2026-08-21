export const translations = {
  uk: {
    navbar: {
      home: 'Огляд',
      bots: 'Боти',
      backtests: 'Бектести',
      emulator: 'Емулятор',
      login: 'Увійти',
      register: 'Реєстрація',
      logoutAria: 'Вийти',
      accountAria: 'Профіль',
      homeAria: 'Головна AlgoTradeDynamics',
    },
    footer: {
      caption: 'Дипломний MVP · Neoversity MSc Computer Science · 2026',
      product: 'Продукт',
      team: 'Команда',
      backtestEngine: 'Backtest engine',
      tradingBots: 'Trading bots',
      legal:
        'Цей MVP не виконує реальних торгових операцій і не є фінансовою порадою. Призначений лише для тестування алгоритмів на локальному exchange emulator.',
      githubAria: 'GitHub',
    },
    hero: {
      pill: 'Реальний bot worker · Exchange emulator · Historical replay',
      titleStart: 'Тестуйте торгового бота',
      titleAccent: 'без ризику',
      titleEnd: 'для капіталу.',
      lead:
        'Оберіть Grid Bot або Pattern Scalper і проганяйте ту саму runtime-логіку через Bybit-compatible emulator: ордери, LONG/SHORT, SL/TP, комісії, equity та drawdown.',
      startBacktest: 'Запустити Backtest',
      howItWorks: 'Як це працює',
      badgeLogic: 'Real bot logic',
      badgeRisk: 'Risk-controlled',
      badgeData: 'Historical datasets',
      periodLabel: 'за 366 днів',
      winRateLabel: 'time in position',
      chipGrid: 'Grid levels',
      chipDd: 'Max DD',
    },
    features: {
      eyebrow: 'Що всередині',
      titleStart: 'Усе для зрілого',
      titleAccent: 'backtesting',
      titleEnd: 'Без зайвого шуму.',
      lead:
        'MVP сфокусований на одній задачі — дати трейдеру безпечне середовище для перевірки ідеї перед тим, як ризикувати реальним капіталом.',
      items: [
        {
          title: 'Той самий bot worker',
          text: 'Backtest запускає snapshot Grid Bot або Pattern Scalper через той самий strategy registry, order lifecycle, risk logic та emulator/live runtime.',
        },
        {
          title: 'Risk-controlled execution',
          text: 'Ізольований тестовий акаунт, баланс, leverage, fees, slippage та execution path не торкаються звичайної історії бота.',
        },
        {
          title: 'Equity curve у реальному часі',
          text: 'Графік ціни показує entries/exits вибраної стратегії, cancelled orders, equity, drawdown і position exposure.',
        },
        {
          title: 'Глибокі метрики',
          text: 'PnL, fees, max drawdown, worst unrealized loss, time in position, time in loss, recovery та max exposure.',
        },
        {
          title: 'Журнал угод',
          text: 'Orders, executions, position changes, cycles і worker events з переходом із таблиці до потрібного моменту графіка.',
        },
        {
          title: 'Історія запусків',
          text: 'Кожен backtest зберігається в базі даних. Можна порівнювати конфігурації, відкривати минулі запуски та аналізувати тренди.',
        },
      ],
    },
    howItWorks: {
      eyebrow: 'Як це працює',
      titleStart: 'Чотири кроки.',
      titleAccent: 'Жодного ризику.',
      lead:
        'Симуляція використовує реальні історичні дані. Жодних реальних ордерів: окремий exchange emulator відтворює Bybit API та зберігає повний стан тестового акаунта.',
      steps: [
        {
          title: 'Оберіть існуючого бота',
          text: 'Backtest зберігає snapshot його grid, TP, order quantity та risk settings, не змінюючи оригінал.',
        },
        {
          title: 'Оберіть історичний dataset',
          text: 'Вкажіть interval, період, execution path, початковий баланс, fees і slippage.',
        },
        {
          title: 'Запустіть ізольований прогін',
          text: 'Система створить тимчасовий emulator account і програє свічки через реальні orders, fills, positions та TP.',
        },
        {
          title: 'Запустіть і аналізуйте',
          text: 'Дивіться ордери на графіку, цикли, equity, drawdown, час у позиції та просадці, executions і конфігурацію запуску.',
        },
      ],
    },
    strategies: {
      eyebrow: 'Режими тестування',
      titleStart: 'Один бот.',
      titleAccent: 'Три рівні перевірки.',
      lead:
        'Від ручного edge-case до багатомісячного історичного прогону без окремої спрощеної торгової логіки.',
      cards: [
        {
          tag: 'Інтерактивний',
          name: 'Ручне тестування',
          desc: 'Рухайте ціну руками, перевіряйте конкретні edge cases і дивіться, як реальний bot worker створює ордери, позицію та TP.',
          params: ['Точний контроль ціни', 'Live ордери та події'],
        },
        {
          tag: 'Повторюваний',
          name: 'Сценарне тестування',
          desc: 'Зберігайте послідовності руху ціни та повторюйте той самий сценарій після змін алгоритму.',
          params: ['Збережені шляхи ціни', 'Пауза та покроковий режим'],
        },
        {
          tag: 'Історичний',
          name: 'Backtesting бота',
          desc: 'Оберіть існуючого бота й програйте реальні історичні свічки через той самий Bybit-compatible emulator.',
          params: ['Ордери на графіку ціни', 'Equity, drawdown та exposure'],
        },
      ],
    },
    cta: {
      eyebrow: 'Готові спробувати?',
      titleStart: 'Запустіть перший backtest',
      titleAccent: 'за 30 секунд.',
      lead:
        'Оберіть одного зі своїх ботів, dataset і період. Backtest створить ізольований акаунт та збере повний звіт.',
      button: 'Відкрити Bot Backtests',
    },
    login: {
      eyebrow: 'Вхід',
      title: 'З поверненням.',
      lead: 'Увійдіть, щоб працювати з ботами, emulator та backtests.',
      email: 'Email',
      password: 'Пароль',
      submit: 'Увійти',
      submitLoading: 'Вхід…',
      noAccount: 'Немає акаунта?',
      registerLink: 'Зареєструватися',
      demo: 'Демо',
      errorFallback: 'Не вдалося увійти',
    },
    register: {
      eyebrow: 'Реєстрація',
      title: 'Створіть акаунт.',
      lead: 'Зареєструйтеся, щоб створювати ботів, запускати emulator і зберігати історичні тести.',
      email: 'Email',
      password: 'Пароль',
      passwordPlaceholder: 'мінімум 6 символів',
      passwordHint: 'Щонайменше 6 символів.',
      submit: 'Зареєструватися',
      submitLoading: 'Створення…',
      haveAccount: 'Вже маєте акаунт?',
      loginLink: 'Увійти',
      shortPassword: 'Пароль має містити щонайменше 6 символів',
      errorFallback: 'Не вдалося зареєструватися',
    },
    account: {
      eyebrow: 'Обліковий запис',
      title: 'Ваш профіль',
      email: 'Email',
      savedBacktests: 'Збережених backtest-сесій',
      createdAt: 'Акаунт створено',
      myBacktests: 'Мої backtests',
      logout: 'Вийти',
    },
  },
  en: {
    navbar: {
      home: 'Overview',
      bots: 'Bots',
      backtests: 'Backtests',
      emulator: 'Emulator',
      login: 'Log in',
      register: 'Register',
      logoutAria: 'Log out',
      accountAria: 'Account',
      homeAria: 'AlgoTradeDynamics home',
    },
    footer: {
      caption: 'Thesis MVP · Neoversity MSc Computer Science · 2026',
      product: 'Product',
      team: 'Team',
      backtestEngine: 'Backtest engine',
      tradingBots: 'Trading bots',
      legal:
        'This MVP does not execute real trades and is not financial advice. It is intended only for algorithm testing in a local exchange emulator.',
      githubAria: 'GitHub',
    },
    hero: {
      pill: 'Real bot worker · Exchange emulator · Historical replay',
      titleStart: 'Test your trading bot',
      titleAccent: 'without risking',
      titleEnd: 'capital.',
      lead:
        'Choose Grid Bot or Pattern Scalper and run the same runtime logic through a Bybit-compatible emulator: orders, LONG/SHORT, SL/TP, fees, equity, and drawdown.',
      startBacktest: 'Run backtest',
      howItWorks: 'How it works',
      badgeLogic: 'Real bot logic',
      badgeRisk: 'Risk-controlled',
      badgeData: 'Historical datasets',
      periodLabel: 'for 366 days',
      winRateLabel: 'time in position',
      chipGrid: 'Grid levels',
      chipDd: 'Max DD',
    },
    features: {
      eyebrow: 'What is inside',
      titleStart: 'Everything for robust',
      titleAccent: 'backtesting',
      titleEnd: 'No extra noise.',
      lead:
        'This MVP focuses on one goal: give a trader a safe environment to validate ideas before risking real capital.',
      items: [
        {
          title: 'The same bot worker',
          text: 'Backtest runs Grid Bot or Pattern Scalper snapshots through the same strategy registry, order lifecycle, risk logic, and emulator/live runtime.',
        },
        {
          title: 'Risk-controlled execution',
          text: 'Isolated test account, balance, leverage, fees, slippage, and execution path never affect the bot regular history.',
        },
        {
          title: 'Real-time equity curve',
          text: 'Price chart shows strategy entries/exits, cancelled orders, equity, drawdown, and position exposure.',
        },
        {
          title: 'Deep metrics',
          text: 'PnL, fees, max drawdown, worst unrealized loss, time in position, time in loss, recovery, and max exposure.',
        },
        {
          title: 'Trade journal',
          text: 'Orders, executions, position changes, cycles, and worker events with links from table rows to chart moments.',
        },
        {
          title: 'Run history',
          text: 'Every backtest is saved in the database. Compare configurations, open historical runs, and analyze trends.',
        },
      ],
    },
    howItWorks: {
      eyebrow: 'How it works',
      titleStart: 'Four steps.',
      titleAccent: 'Zero risk.',
      lead:
        'Simulation uses real historical data. No real orders: a separate exchange emulator reproduces Bybit API and stores complete test-account state.',
      steps: [
        {
          title: 'Choose an existing bot',
          text: 'Backtest stores a snapshot of its grid, TP, order quantity, and risk settings without changing the original.',
        },
        {
          title: 'Choose a historical dataset',
          text: 'Set interval, period, execution path, initial balance, fees, and slippage.',
        },
        {
          title: 'Run an isolated pass',
          text: 'The system creates a temporary emulator account and replays candles through real orders, fills, positions, and TP.',
        },
        {
          title: 'Review and analyze',
          text: 'Inspect orders on chart, cycles, equity, drawdown, time in position/loss, executions, and run configuration.',
        },
      ],
    },
    strategies: {
      eyebrow: 'Testing modes',
      titleStart: 'One bot.',
      titleAccent: 'Three validation levels.',
      lead:
        'From manual edge-case checks to multi-month historical replay without a simplified trading core.',
      cards: [
        {
          tag: 'Interactive',
          name: 'Manual testing',
          desc: 'Move price manually, validate specific edge cases, and watch how the real bot worker creates orders, position, and TP.',
          params: ['Exact price control', 'Live orders and events'],
        },
        {
          tag: 'Repeatable',
          name: 'Scenario testing',
          desc: 'Save price move sequences and replay the same scenario after algorithm updates.',
          params: ['Saved price paths', 'Pause and step mode'],
        },
        {
          tag: 'Historical',
          name: 'Bot backtesting',
          desc: 'Pick an existing bot and replay real historical candles through the same Bybit-compatible emulator.',
          params: ['Orders on price chart', 'Equity, drawdown, and exposure'],
        },
      ],
    },
    cta: {
      eyebrow: 'Ready to try?',
      titleStart: 'Run your first backtest',
      titleAccent: 'in 30 seconds.',
      lead:
        'Select one of your bots, dataset, and period. Backtest creates an isolated account and generates a full report.',
      button: 'Open bot backtests',
    },
    login: {
      eyebrow: 'Log in',
      title: 'Welcome back.',
      lead: 'Log in to work with bots, emulator, and backtests.',
      email: 'Email',
      password: 'Password',
      submit: 'Log in',
      submitLoading: 'Signing in…',
      noAccount: 'No account?',
      registerLink: 'Register',
      demo: 'Demo',
      errorFallback: 'Failed to log in',
    },
    register: {
      eyebrow: 'Register',
      title: 'Create an account.',
      lead: 'Register to create bots, run the emulator, and store historical test runs.',
      email: 'Email',
      password: 'Password',
      passwordPlaceholder: 'minimum 6 characters',
      passwordHint: 'At least 6 characters.',
      submit: 'Register',
      submitLoading: 'Creating…',
      haveAccount: 'Already have an account?',
      loginLink: 'Log in',
      shortPassword: 'Password must contain at least 6 characters',
      errorFallback: 'Failed to register',
    },
    account: {
      eyebrow: 'Account',
      title: 'Your profile',
      email: 'Email',
      savedBacktests: 'Saved backtest sessions',
      createdAt: 'Account created',
      myBacktests: 'My backtests',
      logout: 'Log out',
    },
  },
};
