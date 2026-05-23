FROM python:3.11-slim

WORKDIR /app

# Install dependencies — backend-only requirements (no streamlit/plotly)
COPY backend/requirements_backend.txt ./
RUN pip install --no-cache-dir -r requirements_backend.txt

# Copy application code
COPY src/       ./src/
COPY backend/   ./backend/
COPY dashboard/ ./dashboard/

# Bake the CSV into the image at a separate path.
# entrypoint.sh copies it to /app/data/ (the persistent volume) on every start
# so the volume always has the latest version after a redeploy.
COPY data/msp_v2.csv ./data_static/msp_v2.csv

# /app/data/ is where the persistent volume will be mounted.
# Pre-create it so the entrypoint copy doesn't fail on a cold volume.
RUN mkdir -p /app/data

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
