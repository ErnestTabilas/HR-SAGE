# HR-SAGE: Harvest-Ready Sugarcane Assessment via GIS and Earth Observation

**HR-SAGE** is a **web-based geospatial decision support system** that enables **sugarcane farmers, millers, and agricultural experts** to monitor and assess the **growth stages of sugarcane crops** across the Philippines using **remote sensing**, **NDVI analysis**, and **interactive GIS mapping**.

## 🌱 Features

- **Automated Sugarcane Detection & Classification**  
  Utilizes the **GEDI-Sentinel-2 global sugarcane map** to isolate sugarcane pixels and classifies them into four growth stages using **NDVI** and **nTallMonths** (canopy height frequency).
- **NDVI-Based Growth Stage Analysis**  
  Applies validated NDVI thresholds to determine if crops are in Germination, Tillering, Grand Growth, or Ripening stages.

- **Geospatial Visualization with Leaflet.js**  
  Interactive map with **pixel-level sugarcane point visualization**, growth stage toggles, location search, and summary export.

- **Google Earth Engine (GEE) Integration**  
  Fetches satellite data and computes NDVI for verified sugarcane pixels every **5 days**.

- **User-Friendly Web Platform**  
  Intuitive UI designed for accessibility across devices with minimal learning curve.

## 🔧 Technologies Used

- **Google Earth Engine (GEE)** – Satellite data processing and geospatial analysis.
- **GEDI-Sentinel-2 Global Sugarcane Map** – High-resolution mask for verified sugarcane pixels.
- **Earth Engine Python API** – Backend data fetching and automation.
- **GitHub Actions** – Automates periodic data updates (every 5 days).
- **Google Drive** – Temporary storage for extracted CSVs.
- **Supabase** – Cloud-based database for storing processed geospatial data.
- **Flask (Python)** – Backend API for parsing and classifying growth stages.
- **React.js + Leaflet.js + Tailwind CSS** – Frontend for map display and user interaction.
- **Vercel / Render** – Deployment platforms for frontend and backend services.

## 🚀 How It Works

1. **Data Extraction:**  
   Every 5 days, GitHub triggers a GEE script to extract Sentinel-2 NDVI values and nTallMonths from the GEDI dataset, limited to sugarcane pixels in the Philippines.

2. **Preprocessing:**  
   Extracted data (lat, lon, NDVI, canopy frequency) is stored in Google Drive, parsed by the Flask backend, and classified into growth stages using empirically derived thresholds.

3. **Data Storage & API:**  
   Processed data is uploaded to **Supabase**, and the Flask API serves it to the frontend in real-time.

4. **Visualization:**  
   The **React + Leaflet frontend** renders an interactive map, showing color-coded sugarcane points by growth stage, with filtering, searching, and export features.

## ✅ System Validation

- **Expert-validated** classification logic based on crop height and NDVI.
- **System Usability Scale (SUS)** score of **83 (Excellent)** from user feedback.
- Visual and spatial accuracy confirmed via comparison with original GEDI-Sentinel datasets.
