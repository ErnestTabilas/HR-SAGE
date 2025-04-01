from flask import Flask, jsonify, Response, request
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
    
    
    # Print to check if request parameters exist
    print("Fetching NDVI data...")


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

    # Classification ranges
    germination = (ndvi_array >= 0.1) & (ndvi_array < 0.2)
    tillering = (ndvi_array >= 0.2) & (ndvi_array < 0.4)
    grand_growth = (ndvi_array >= 0.5) & (ndvi_array < 0.7)
    ripening = (ndvi_array >= 0.3) & (ndvi_array < 0.5)

    # Assign classification
    classified_ndvi[germination] = 1  # Yellow
    classified_ndvi[tillering] = 2  # Orange
    classified_ndvi[grand_growth] = 3  # Green
    classified_ndvi[ripening] = 4  # Red

    # Debugging Output - Print Sample NDVI Values & Their Colors <============================================ SAMPLE
    sample_indices = [(100, 100), (150, 150), (200, 200)]
    for x, y in sample_indices:
        if 0 <= x < ndvi_array.shape[0] and 0 <= y < ndvi_array.shape[1]:
            ndvi_value = ndvi_array[x, y]
            classified_value = classified_ndvi[x, y]
            print(f"NDVI: {ndvi_value:.2f} at ({x}, {y}) -> Class: {classified_value}")
    #=================================================================================================================

    # ✅ Convert classified NDVI to a new GeoTIFF
    out_raster = BytesIO()
    with rasterio.open(
        out_raster, 'w', driver='GTiff', height=dataset.height, width=dataset.width,
        count=1, dtype=rasterio.uint8, crs=dataset.crs, transform=dataset.transform
    ) as dst:
        dst.write(classified_ndvi, 1)

    out_raster.seek(0)
    
    return Response(out_raster.read(), mimetype="image/tiff", headers={"Content-Length": str(out_raster.getbuffer().nbytes)})

@app.route('/check-ndvi-classification', methods=['GET'])
def check_ndvi_classification():
    """Check the NDVI classification for a specific point"""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)

    conn = psycopg2.connect(**DB_SETTINGS)
    cur = conn.cursor()

    cur.execute("""
        SELECT ST_Value(rast, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
        FROM ndvi_data
        ORDER BY rid DESC LIMIT 1;
    """, (lng, lat))  # Note: Lat/Lng order

    result = cur.fetchone()
    cur.close()
    conn.close()

    if not result or result[0] is None:
        return jsonify({"error": "No NDVI data at this location"}), 404

    ndvi_value = result[0]
    
    # Determine classification
    if 0.1 <= ndvi_value < 0.2:
        classification = "Yellow (Germination)"
    elif 0.2 <= ndvi_value < 0.4:
        classification = "Orange (Tillering)"
    elif 0.5 <= ndvi_value < 0.7:
        classification = "Green (Grand Growth)"
    elif 0.3 <= ndvi_value < 0.5:
        classification = "Red (Ripening)"
    else:
        classification = "Unclassified"

    return jsonify({"ndvi": ndvi_value, "classification": classification})

@app.route('/get-ndvi-metadata', methods=['GET'])
def get_ndvi_metadata():
    ndvi_path = "path/to/NDVI_LaCarlota.tif"  # Update path
    try:
        with rasterio.open(ndvi_path) as src:
            bounds = src.bounds  # (left, bottom, right, top)
            return jsonify({
                "success": True,
                "extent": [bounds.left, bounds.bottom, bounds.right, bounds.top],
                "crs": src.crs.to_string()
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    app.run(debug=True, port=5000)
