from app.services.backtest_service import _apply_execution_to_cycle_state, _sort_executions


def _state():
    return {
        "current_cycle": None,
        "cycle_number": 0,
        "closed_cycle_count": 0,
        "execution_position_qty": 0.0,
        "execution_avg_entry": 0.0,
        "max_position_qty": 0.0,
        "max_position_value": 0.0,
    }


def _execution(seq, timestamp, side, qty, price, fee=0.0, closed_pnl=0.0):
    return {
        "execId": f"exec-{seq}",
        "execSeq": seq,
        "execTime": timestamp,
        "side": side,
        "execQty": str(qty),
        "execPrice": str(price),
        "execFee": str(fee),
        "closedPnl": str(closed_pnl),
    }


def test_same_timestamp_uses_exchange_sequence_not_input_order():
    executions = [
        _execution(3, 2000, "Buy", 0.001, 110),
        _execution(2, 2000, "Sell", 0.001, 105, closed_pnl=5),
        _execution(1, 1000, "Buy", 0.001, 100),
    ]

    ordered = _sort_executions(executions)

    assert [item["execSeq"] for item in ordered] == [1, 2, 3]


def test_tp_close_then_new_entry_creates_two_distinct_cycles():
    state = _state()
    closed = []
    executions = [
        _execution(1, 1000, "Buy", 0.001, 100, fee=0.01),
        _execution(2, 2000, "Sell", 0.001, 105, fee=0.01, closed_pnl=0.005),
        _execution(3, 2000, "Buy", 0.001, 110, fee=0.01),
        _execution(4, 3000, "Buy", 0.001, 100, fee=0.01),
        _execution(5, 4000, "Sell", 0.002, 108, fee=0.02, closed_pnl=0.006),
    ]

    for execution in executions:
        result = _apply_execution_to_cycle_state(state, execution)
        if result is not None:
            closed.append(result)

    assert len(closed) == 2
    assert state["closed_cycle_count"] == 2
    assert state["current_cycle"] is None
    assert state["execution_position_qty"] == 0

    first, second = closed
    assert first["started_at"] == 1000
    assert first["closed_at"] == 2000
    assert first["entries_filled"] == 1
    assert first["max_qty"] == 0.001
    assert first["fees"] == 0.02

    assert second["started_at"] == 2000
    assert second["closed_at"] == 4000
    assert second["entries_filled"] == 2
    assert second["max_qty"] == 0.002
    assert second["fees"] == 0.04
    assert state["max_position_qty"] == 0.002
