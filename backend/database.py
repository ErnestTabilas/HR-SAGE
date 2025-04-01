import json
import psycopg2
from flask import Flask, jsonify
from flask_cors import CORS  # Import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Database connection
conn = psycopg2.connect("dbname=hr_sage user=postgres password=ernest host=localhost port=5432")

@app.route('/ndvi-data', methods=['GET'])
def get_ndvi_data():
    try:
        cur = conn.cursor()

        query = """
        SELECT ST_AsGeoJSON((ST_DumpAsPolygons(rast)).geom), 
               (ST_DumpAsPolygons(rast)).val 
        FROM sugarcane_ndvi;
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        ndvi_data = []
        for row in rows:
            geometry = row[0]
            ndvi_value = row[1]
            
            # Handle NaN values in ndvi_value
            if str(ndvi_value).lower() == 'nan':
                ndvi_value = None  # Or any other placeholder, e.g., 0 or -1

            ndvi_data.append({"geometry": geometry, "ndvi_value": ndvi_value})
        
        cur.close()
        
        return jsonify(ndvi_data)
    
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/sugarcane-locations", methods=["GET"])
def get_sugarcane_locations():
    query = """
    WITH locations AS (
        SELECT
            ST_Centroid(ST_Envelope(rast)) AS centroid,
            ST_Value(rast, ST_Centroid(ST_Envelope(rast))) AS ndvi_value
        FROM sugarcane_ndvi
        WHERE ST_Value(rast, ST_Centroid(ST_Envelope(rast))) > 0.1 -- Adjust threshold for detecting sugarcane
    )
    SELECT
        ST_X(centroid) AS lon,
        ST_Y(centroid) AS lat
    FROM locations;
    """
    try:
        cur = conn.cursor()
        cur.execute(query)
        locations = cur.fetchall()
        cur.close()
        
        # Debugging: Print the locations fetched from the query
        print(f"Sugarcane locations fetched: {locations}")
        
        return jsonify([{"lat": loc[1], "lng": loc[0]} for loc in locations])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
