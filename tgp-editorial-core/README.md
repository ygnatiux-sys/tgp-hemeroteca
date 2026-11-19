# TGP Editorial Core (`127.0.0.1:8000`)

Cerebro FastAPI Desk-First desacoplado para curaduría documental TGP.

## Instalación local (una vez)

```powershell
cd C:\Users\ygnat\tgp-hemeroteca\tgp-editorial-core
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Asegurate de tener ADC local activo:

```powershell
gcloud auth application-default login
```

## Levantar servidor local

```powershell
cd C:\Users\ygnat\tgp-hemeroteca\tgp-editorial-core
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- Healthcheck Vertex/ADC: `http://127.0.0.1:8000/health`
- Swagger UI: `http://127.0.0.1:8000/docs`

## Tests unitarios (filtro comercial)

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## Pruebas en PowerShell (`Invoke-RestMethod` UTF-8)

```powershell
$body1 = [System.Text.Encoding]::UTF8.GetBytes((@{ query="pirámide de la Antártida"; editorial_line="alternative"; mode="magazines"; limit=35 } | ConvertTo-Json))
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/curate -ContentType "application/json; charset=utf-8" -Body $body1

$body2 = [System.Text.Encoding]::UTF8.GetBytes((@{ query="Códices mayas del período clásico"; editorial_line="official"; mode="ebooks_thesis"; limit=40 } | ConvertTo-Json))
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/curate -ContentType "application/json; charset=utf-8" -Body $body2
```
