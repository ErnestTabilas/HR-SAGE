from flask import Flask, jsonify, Response
from flask_cors import CORS
import psycopg2
import rasterio
import numpy as np
from io import BytesIO

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# ✅ Database connection settings
DB_SETTINGS = {
    "dbname": "hr_sage",
    "user": "postgres",
    "password": "ernest",
    "host": "localhost",
    "port": "5432"
}

# ✅ Function to get the latest NDVI raster
def get_latest_ndvi():
    conn = psycopg2.connect(**DB_SETTINGS)
    cur = conn.cursor()
    
    # ✅ Ensure correct column name (`rast`)
    cur.execute("SELECT ST_AsTIFF(rast) FROM ndvi_data ORDER BY rid DESC LIMIT 1;")
    result = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if result and result[0]:
        return result[0]  # ✅ Returns the raster as binary
    return None

# ✅ Endpoint: Fetch the latest NDVI raster as TIFF
@app.route('/get-latest-ndvi', methods=['GET'])
def latest_ndvi():
    """Fetch the latest NDVI raster as TIFF."""
    ndvi_data = get_latest_ndvi()

    if ndvi_data:
        return Response(ndvi_data, mimetype="image/tiff", headers={"Content-Length": str(len(ndvi_data))})
    else:
        return jsonify({"error": "No NDVI data found"}), 404

# ✅ Fetch NDVI metadata (Bounding Box)
@app.route('/get-ndvi-info', methods=['GET'])
def get_ndvi_info():
    """Fetch the latest NDVI raster along with its bounding box."""
    conn = psycopg2.connect(**DB_SETTINGS)
    cur = conn.cursor()
    
    # ✅ Convert raster to geometry before extracting bounding box
    cur.execute("""
        SELECT 
               ST_XMin(ST_ConvexHull(rast))::float, 
               ST_YMin(ST_ConvexHull(rast))::float, 
               ST_XMax(ST_ConvexHull(rast))::float, 
               ST_YMax(ST_ConvexHull(rast))::float
        FROM ndvi_data
        ORDER BY rid DESC
        LIMIT 1;
    """)
    
    result = cur.fetchone()
    cur.close()
    conn.close()

    if result:
        bbox = {
            "southwest": [result[1], result[0]],  # (YMin, XMin)
            "northeast": [result[3], result[2]]   # (YMax, XMax)
        }
        return jsonify(bbox)
    else:
        return jsonify({"error": "No NDVI metadata found"}), 404

# ✅ Fetch & Classify NDVI for Growth Stages
@app.route('/get-ndvi-classified', methods=['GET'])
def get_ndvi_classified():
    """Fetch NDVI raster and classify pixels into sugarcane growth stages."""
    conn = psycopg2.connect(**DB_SETTINGS)
    cur = conn.cursor()

    # ✅ Extract NDVI raster as an array
    cur.execute("SELECT ST_AsGDALRaster(rast, 'GTiff') FROM ndvi_data ORDER BY rid DESC LIMIT 1;")
    result = cur.fetchone()
    
    cur.close()
    conn.close()

    if not result or not result[0]:
        return jsonify({"error": "No NDVI data found"}), 404

    # ✅ Convert raster to NumPy array
    with rasterio.open(BytesIO(result[0])) as dataset:
        ndvi_array = dataset.read(1)  # Read band 1 (NDVI values)
    
    # ✅ Classify NDVI into sugarcane growth stages
    classified_ndvi = np.zeros_like(ndvi_array, dtype=np.uint8)

    classified_ndvi[(ndvi_array >= 0.1) & (ndvi_array < 0.2)] = 1  # Germination (Yellow)
    classified_ndvi[(ndvi_array >= 0.2) & (ndvi_array < 0.4)] = 2  # Tillering (Orange)
    classified_ndvi[(ndvi_array >= 0.5) & (ndvi_array < 0.7)] = 3  # Grand Growth (Green)
    classified_ndvi[(ndvi_array >= 0.3) & (ndvi_array < 0.5)] = 4  # Ripening (Red)

    # ✅ Convert classified NDVI to a new GeoTIFF
    out_raster = BytesIO()
    with rasterio.open(
        out_raster, 'w', driver='GTiff', height=dataset.height, width=dataset.width,
        count=1, dtype=rasterio.uint8, crs=dataset.crs, transform=dataset.transform
    ) as dst:
        dst.write(classified_ndvi, 1)

    out_raster.seek(0)
    
    return Response(out_raster.read(), mimetype="image/tiff", headers={"Content-Length": str(out_raster.getbuffer().nbytes)})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
