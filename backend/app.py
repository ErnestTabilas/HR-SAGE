import os
import rasterio
import numpy as np
from flask import Flask, jsonify
from flask_cors import CORS
import logging

# Set up basic logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
CORS(app)

# Get the current working directory (where app.py is located)
current_dir = os.path.dirname(os.path.abspath(__file__))

# Construct the relative path to the GeoTIFF file in the data folder
geotiff_path = os.path.join(current_dir, '..', 'data', 'NDVI_Victorias.tif')

def classify_growth_stage(ndvi_value):
    """Classify the growth stage based on NDVI value."""
    if ndvi_value >= 0.5:
        return "Grand Growth", "yellow"  # Grand Growth Stage (NDVI: 0.5 - 0.7)
    elif ndvi_value >= 0.3:
        return "Ripening", "green"  # Ripening Stage (NDVI: 0.3 - 0.5)
    elif ndvi_value >= 0.2:
        return "Tillering", "orange"  # Tillering Stage (NDVI: 0.2 - 0.4)
    elif ndvi_value >= 0.1:
        return "Germination", "red"  # Germination Stage (NDVI: 0.1 - 0.2)
    else:
        return "No Sugarcane", "gray"  # No sugarcane detected (NDVI below 0.1)

@app.route('/ndvi-data', methods=['GET'])
def get_ndvi_data():
    try:
        logging.debug("Opening GeoTIFF file at: %s", geotiff_path)
        
        # Check if the file exists
        if not os.path.exists(geotiff_path):
            logging.error("GeoTIFF file not found at: %s", geotiff_path)
            return jsonify({"error": "GeoTIFF file not found"}), 500
        
        # Open the local GeoTIFF file
        with rasterio.open(geotiff_path) as src:
            logging.debug("GeoTIFF file opened successfully.")
            
            # Get image bounds (min and max lat/lon)
            bounds = src.bounds
            min_lon, min_lat, max_lon, max_lat = bounds

            # Return the bounds to the frontend for map adjustment
            return jsonify({
                "min_lon": min_lon,
                "min_lat": min_lat,
                "max_lon": max_lon,
                "max_lat": max_lat
            })

    except Exception as e:
        logging.error("Error in /ndvi-data endpoint: %s", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/sugarcane-locations", methods=["GET"])
def get_sugarcane_locations():
    try:
        logging.debug("Opening GeoTIFF file at: %s", geotiff_path)
        
        # Open the local GeoTIFF file
        with rasterio.open(geotiff_path) as src:
            logging.debug("GeoTIFF file opened successfully.")
            
            # Read the raster data into a numpy array
            raster_data = src.read(1)  # Read the first band (assuming it's a single-band raster)
            transform = src.transform

            # Ignore roads, rivers, and other non-cropland areas by applying a cropland NDVI threshold
            sugarcane_mask = (raster_data > 0.1)  # Ignore NDVI values lower than 0.1 (non-cropland)
            sugarcane_mask &= (raster_data <= 1.0)  # Ensure valid NDVI values (NDVI max is 1.0)

            # Extract the coordinates of the detected sugarcane locations
            sugarcane_locations = []
            for row in range(sugarcane_mask.shape[0]):
                for col in range(sugarcane_mask.shape[1]):
                    if sugarcane_mask[row, col]:
                        # Convert pixel coordinates (row, col) to geographical coordinates
                        lon, lat = transform * (col, row)
                        
                        # Get the NDVI value at this pixel
                        ndvi_value = raster_data[row, col]
                        
                        # Classify the sugarcane based on NDVI value
                        stage, color = classify_growth_stage(ndvi_value)
                        
                        # Append location with classification and color
                        sugarcane_locations.append({
                            "lat": lat,
                            "lng": lon,
                            "stage": stage,
                            "color": color
                        })

            logging.debug("Found %d sugarcane locations.", len(sugarcane_locations))
            return jsonify(sugarcane_locations)

    except Exception as e:
        logging.error("Error in /sugarcane-locations endpoint: %s", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
