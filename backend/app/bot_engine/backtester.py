"""Backtesting engine: executes signals against candles and computes metrics."""
from __future__ import annotations

from dataclasses import dataclass

from app.bot_engine.data_loader import Candle
from app.bot_engine.strategies.base import Strategy


@dataclass
class SimulatedTrade:
    symbol: str
    side: str
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    pnl_percent: float
    reason: str


@dataclass
class EquityPoint:
    date: str
    value: float


@dataclass
class BacktestResult:
    symbol: str
    strategy_name: str
    strategy_params: dict
    risk_params: dict
    initial_balance: float
    final_balance: float
    total_pnl: float
    total_pnl_percent: float
    max_drawdown_percent: float
    win_rate_percent: float
    trades_count: int
    trades: list[SimulatedTrade]
    equity_points: list[EquityPoint]


class Backtester:
    """Executes a `Strategy` against historical candles with risk limits."""

    def __init__(
        self,
        strategy: Strategy,
        candles: list[Candle],
        symbol: str = "BTC/USDT",
        initial_balance: float = 10_000,
        position_size_percent: float = 20,
        stop_loss_percent: float = 5,
        max_drawdown_percent: float = 20,
    ) -> None:
        if not candles:
            raise ValueError("Candles dataset is empty")
        if initial_balance <= 0:
            raise ValueError("initial_balance must be positive")

        self.strategy = strategy
        self.candles = candles
        self.symbol = symbol
        self.initial_balance = initial_balance
        self.position_size_percent = position_size_percent
        self.stop_loss_percent = stop_loss_percent
        self.max_drawdown_percent = max_drawdown_percent

    def run(self) -> BacktestResult:
        signals = self.strategy.generate_signals(self.candles)

        balance = self.initial_balance
        peak_balance = self.initial_balance
        max_drawdown = 0.0

        position_quantity = 0.0
        entry_price = 0.0
        entry_date = ""

        trades: list[SimulatedTrade] = []
        equity_points: list[EquityPoint] = [
            EquityPoint(date=self.candles[0].date, value=round(balance, 2))
        ]

        risk_halt = False

        for candle, signal in zip(self.candles, signals):
            price = candle.close
            current_equity = balance + (
                (price - entry_price) * position_quantity if position_quantity > 0 else 0
            )

            peak_balance = max(peak_balance, current_equity)
            drawdown = (
                (peak_balance - current_equity) / peak_balance * 100
                if peak_balance > 0
                else 0
            )
            max_drawdown = max(max_drawdown, drawdown)

            # Risk halt: close position and stop trading.
            if drawdown >= self.max_drawdown_percent and position_quantity > 0:
                balance, trade = self._close_position(
                    balance, position_quantity, entry_price, price,
                    entry_date, candle.date, "Max drawdown limit",
                )
                trades.append(trade)
                position_quantity = 0.0
                equity_points.append(EquityPoint(date=candle.date, value=round(balance, 2)))
                risk_halt = True
                break

            # Stop-loss for open position.
            if position_quantity > 0:
                loss_percent = (entry_price - price) / entry_price * 100
                if loss_percent >= self.stop_loss_percent:
                    balance, trade = self._close_position(
                        balance, position_quantity, entry_price, price,
                        entry_date, candle.date, "Stop-loss",
                    )
                    trades.append(trade)
                    position_quantity = 0.0
                    equity_points.append(EquityPoint(date=candle.date, value=round(balance, 2)))
                    continue

            # Signal handling.
            if signal == "buy" and position_quantity == 0:
                position_value = balance * (self.position_size_percent / 100)
                position_quantity = position_value / price
                entry_price = price
                entry_date = candle.date
            elif signal == "sell" and position_quantity > 0:
                balance, trade = self._close_position(
                    balance, position_quantity, entry_price, price,
                    entry_date, candle.date, "Strategy exit signal",
                )
                trades.append(trade)
                position_quantity = 0.0

            equity_points.append(EquityPoint(date=candle.date, value=round(current_equity, 2)))

        # Close any open position at end of dataset.
        if not risk_halt and position_quantity > 0:
            last = self.candles[-1]
            balance, trade = self._close_position(
                balance, position_quantity, entry_price, last.close,
                entry_date, last.date, "End of dataset",
            )
            trades.append(trade)
            equity_points.append(EquityPoint(date=last.date, value=round(balance, 2)))

        total_pnl = balance - self.initial_balance
        wins = [t for t in trades if t.pnl > 0]
        win_rate = (len(wins) / len(trades) * 100) if trades else 0.0

        return BacktestResult(
            symbol=self.symbol,
            strategy_name=self.strategy.display_name,
            strategy_params=self.strategy.to_params_dict(),
            risk_params={
                "position_size_percent": self.position_size_percent,
                "stop_loss_percent": self.stop_loss_percent,
                "max_drawdown_percent": self.max_drawdown_percent,
            },
            initial_balance=round(self.initial_balance, 2),
            final_balance=round(balance, 2),
            total_pnl=round(total_pnl, 2),
            total_pnl_percent=round((total_pnl / self.initial_balance) * 100, 2),
            max_drawdown_percent=round(max_drawdown, 2),
            win_rate_percent=round(win_rate, 2),
            trades_count=len(trades),
            trades=trades,
            equity_points=equity_points,
        )

    def _close_position(
        self,
        balance: float,
        quantity: float,
        entry_price: float,
        exit_price: float,
        entry_date: str,
        exit_date: str,
        reason: str,
    ) -> tuple[float, SimulatedTrade]:
        pnl = (exit_price - entry_price) * quantity
        pnl_percent = (exit_price - entry_price) / entry_price * 100
        new_balance = balance + pnl
        trade = SimulatedTrade(
            symbol=self.symbol,
            side="LONG",
            entry_date=entry_date,
            exit_date=exit_date,
            entry_price=round(entry_price, 2),
            exit_price=round(exit_price, 2),
            quantity=round(quantity, 6),
            pnl=round(pnl, 2),
            pnl_percent=round(pnl_percent, 2),
            reason=reason,
        )
        return new_balance, trade
