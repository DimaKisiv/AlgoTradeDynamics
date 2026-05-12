"""CSV candle data loader."""
import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Candle:
    """OHLCV candle representation."""

    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


def load_candles(csv_path: str | Path) -> list[Candle]:
    """Load candles from a CSV file with header `date,open,high,low,close,volume`."""
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    candles: list[Candle] = []
    with path.open("r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            candles.append(
                Candle(
                    date=row["date"],
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=float(row["volume"]),
                )
            )

    if not candles:
        raise ValueError(f"Dataset is empty: {path}")
    return candles
