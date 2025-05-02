FROM python:3.9

# Set work directory
WORKDIR /app

# Install system dependencies required by geospatial libraries
RUN apt-get update && apt-get install -y \
    g++ \
    libpq-dev \
    libgdal-dev \
    gdal-bin \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .

RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source code
COPY . .

# Default command
CMD ["python", "app.py"]
