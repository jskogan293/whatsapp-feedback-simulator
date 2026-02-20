# WhatsApp Content Feedback Simulator - Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (for Pillow)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir flask>=2.3.0 flask-cors>=4.0.0 requests>=2.31.0 Pillow>=10.0.0 gunicorn>=21.0.0 llama-api-client

# Copy application files
COPY server.py .
COPY index.html .
COPY styles.css .
COPY app.js .

# Expose port
EXPOSE 5001

# Run with gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "2", "--timeout", "180", "server:app"]
