import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from supabase import create_client, Client

# ---- Setup ----
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app)

# ---- Supabase Config ----
PAGE_SIZE = 10000  # Define how many rows to fetch per request
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TABLE_NAME = "sugarcane_data" 

if not SUPABASE_URL or not SUPABASE_KEY:
    logging.error("Supabase URL or Key not set in environment variables")
    raise RuntimeError("Missing Supabase credentials")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---- API ----
# ---- Pagination Parameters ----

def fetch_sugarcane_data_from_supabase():
    try:
        all_data = []
        page_size = 10000  # Number of rows per page, adjust based on your needs
        offset = 0  # Starting point for pagination

        while True:
            # Fetch the next page of data
            response = supabase\
                .table(TABLE_NAME)\
                .select("*")\
                .range(offset, offset + page_size - 1)\
                .execute()
            
            # Check if the response contains data
            if response.data:
                all_data.extend(response.data)  # Add this page's data to the overall list
                logging.info(f"Fetched {len(response.data)} rows, total: {len(all_data)}.")
                
                # If fewer rows than the page size are returned, we've reached the end
                if len(response.data) < page_size:
                    logging.info("End of data reached.")
                    break

                # Move to the next page
                offset += page_size
            else:
                logging.warning("No data returned for this page.")
                break
        
        return all_data
    
    except Exception as e:
        logging.error(f"Error fetching data from Supabase: {e}")
        return []


@app.route("/sugarcane-locations", methods=["GET"])
def sugarcane_locations():
    try:
        points = fetch_sugarcane_data_from_supabase()
        logging.info(f"Returning {len(points)} sugarcane points from Supabase.")
        return jsonify({"points": points})
    except Exception as e:
        logging.error(f"Error during data fetching: {e}")
        return jsonify({"error": "Error fetching sugarcane locations"}), 500

if __name__ == "__main__":
    app.run(debug=True)
