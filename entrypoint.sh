#!/bin/bash
set -e

# On first start (or after image update), copy the CSV from the image layer
# into the persistent volume so engine.py can find it at data/msp_v2.csv.
# The volume survives restarts; the image layer always has the latest CSV.
cp /app/data_static/msp_v2.csv /app/data/msp_v2.csv

exec uvicorn backend.main:app --host 0.0.0.0 --port 8080
