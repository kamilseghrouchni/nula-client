FROM python:3.12-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy gateway code
COPY gateway.py .

# Expose port
EXPOSE 9000

# Set environment
ENV GATEWAY_PORT=9000
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:9000/health').raise_for_status()"

# Run the gateway
CMD ["python", "gateway.py"]
