#!/usr/bin/env python3
"""
scripts/db-tools/generate_d1_batches.py
─────────────────────────────────────────────────────────────────────────────
Generador de lotes SQL (batches) para Cloudflare D1.
Toma un archivo SQL masivo (ej. panlingua.sql) y lo fragmenta en lotes de
inserción de tamaño controlado (por defecto 50,000 registros por lote) para
evitar exceder los límites de memoria, tiempo o tamaño de sentencia de Cloudflare D1.
─────────────────────────────────────────────────────────────────────────────
Uso:
    python scripts/db-tools/generate_d1_batches.py
    python scripts/db-tools/generate_d1_batches.py --input panlingua.sql --batch-size 50000
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import re
import argparse
from pathlib import Path

DEFAULT_BATCH_SIZE = 50000
TABLE_NAME = "lexico_periferico"

def split_sql_into_batches(input_path: Path, output_dir: Path, batch_size: int = DEFAULT_BATCH_SIZE):
    if not input_path.exists():
        print(f"❌ Error: El archivo de entrada '{input_path}' no existe.")
        return False

    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n============================================================")
    print(f"📦 [D1 Batch Generator] Dividiendo SQL en lotes")
    print(f"📄 Archivo origen: {input_path} ({input_path.stat().st_size / (1024*1024):.2f} MB)")
    print(f"📁 Directorio destino: {output_dir}")
    print(f"🔢 Tamaño de lote: {batch_size} registros por archivo")
    print(f"============================================================\n")

    current_batch = 1
    current_count = 0
    total_records = 0
    batch_file = None

    def start_new_batch(batch_num):
        batch_path = output_dir / f"part_{batch_num:02d}.sql"
        f = open(batch_path, "w", encoding="utf-8")
        f.write(f"INSERT INTO {TABLE_NAME} VALUES ")
        return f, batch_path

    current_file_handle, current_file_path = start_new_batch(current_batch)

    try:
        with open(input_path, "r", encoding="utf-8", errors="replace") as infile:
            for line in infile:
                stripped = line.strip()
                if not stripped:
                    continue

                # Ignorar instrucciones CREATE, DROP, etc., o encabezados de transacciones
                if stripped.upper().startswith(("CREATE TABLE", "DROP TABLE", "BEGIN TRANSACTION", "COMMIT", "PRAGMA")):
                    continue

                # Si la línea contiene una tupla de valores: ('Language', 'Glottocode', ...)
                # Limpiar terminadores de coma o punto y coma
                if stripped.startswith("(") or "('" in stripped:
                    # Normalizar tupla
                    clean_tuple = stripped.rstrip(";,")
                    if clean_tuple.endswith(")"):
                        if current_count > 0:
                            current_file_handle.write(",\n")
                        else:
                            current_file_handle.write("\n")

                        current_file_handle.write(clean_tuple)
                        current_count += 1
                        total_records += 1

                        if current_count >= batch_size:
                            current_file_handle.write(";\n")
                            current_file_handle.close()
                            print(f"  ✓ Generado {current_file_path.name} ({current_count} registros)")
                            current_batch += 1
                            current_count = 0
                            current_file_handle, current_file_path = start_new_batch(current_batch)

        if current_count > 0:
            current_file_handle.write(";\n")
            current_file_handle.close()
            print(f"  ✓ Generado {current_file_path.name} ({current_count} registros)")
        else:
            current_file_handle.close()
            if current_file_path.exists() and current_file_path.stat().st_size <= len(f"INSERT INTO {TABLE_NAME} VALUES "):
                current_file_path.unlink()

        print(f"\n✅ Proceso completado exitosamente.")
        print(f"📊 Total registros procesados: {total_records:,}")
        print(f"📁 Total lotes generados: {current_batch if current_count > 0 else current_batch - 1}")
        print(f"\n💡 Para cargar un lote a Cloudflare D1 ejecuta:")
        print(f"   npx wrangler d1 execute tgp-panlingua --remote --file={output_dir}/part_01.sql\n")
        return True

    except Exception as e:
        print(f"\n❌ Error durante el procesamiento: {e}")
        if current_file_handle and not current_file_handle.closed:
            current_file_handle.close()
        return False

def main():
    parser = argparse.ArgumentParser(description="Generar lotes SQL para Cloudflare D1")
    parser.add_argument("--input", "-i", type=str, default="panlingua.sql", help="Ruta al archivo SQL fuente")
    parser.add_argument("--output", "-o", type=str, default="panlingua_batches", help="Directorio de salida para los lotes")
    parser.add_argument("--batch-size", "-b", type=int, default=DEFAULT_BATCH_SIZE, help="Cantidad de registros por archivo")

    args = parser.parse_args()
    input_file = Path(args.input)
    output_dir = Path(args.output)

    success = split_sql_into_batches(input_file, output_dir, args.batch_size)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
