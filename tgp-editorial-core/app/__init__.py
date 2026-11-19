"""TGP Editorial Core — Cerebro FastAPI Desk-First."""

import os
from pathlib import Path


def load_local_env() -> Path | None:
    """Carga únicamente el .env propio de tgp-editorial-core/.

    Nunca lee el .env de la raíz del monorepo para evitar que
    GOOGLE_APPLICATION_CREDENTIALS de tgp-mind pise el ADC local.
    """
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return None

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, val)

    return env_path
