"""
Formatting utilities for numbers, currencies, and dates.
"""

def format_currency(val, decimals: int = 0) -> str:
    if val is None:
        return "$0"
    try:
        val_float = float(val)
        if decimals == 0:
            if val_float < 0:
                return f"-${abs(val_float):,.0f}"
            return f"${val_float:,.0f}"
        else:
            if val_float < 0:
                return f"-${abs(val_float):,.{decimals}f}"
            return f"${val_float:,.{decimals}f}"
    except (ValueError, TypeError):
        return "$0"

def format_short_currency(val) -> str:
    if val is None:
        return "$0"
    try:
        val_float = float(val)
        abs_v = abs(val_float)
        prefix = "-" if val_float < 0 else ""
        if abs_v >= 1_000_000:
            return f"{prefix}${abs_v / 1_000_000:.1f}M"
        if abs_v >= 1_000:
            return f"{prefix}${abs_v / 1_000:.0f}k"
        return f"{prefix}${abs_v:.0f}"
    except (ValueError, TypeError):
        return "$0"

def format_percent(val) -> str:
    if val is None:
        return "0.0%"
    try:
        val_float = float(val)
        sign = "+" if val_float > 0 else ""
        return f"{sign}{val_float:.1f}%"
    except (ValueError, TypeError):
        return "0.0%"
