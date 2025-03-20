# HR-SAGE: Harvest-Ready Sugarcane Assessment via GIS and Earth Observation

HR-SAGE is a **geospatial decision support system** designed to help **sugarcane farmers** and **agriculture stakeholders** determine the harvest readiness of sugarcane fields using **satellite data, NDVI analysis, and GIS mapping**.

## 🌱 Features

- **Automated Harvest Readiness Assessment**: Uses **Sentinel-2 satellite imagery** to classify sugarcane fields into different growth stages.
- **Normalized Difference Vegetation Index (NDVI) Analysis**: Analyzes spectral data to estimate crop maturity.
- **Geospatial Mapping with QGIS**: Visualizes **farm-wide and province-wide** sugarcane growth data.
- **Google Earth Engine (GEE) Integration**: Fetches **high-resolution satellite images every 5 days**.
- **Web-Based Platform**: Allows users to view and analyze sugarcane crop health in real-time.

## 🔧 Technologies Used

- **Google Earth Engine (GEE)** - Fetches satellite imagery.
- **PostGIS (PostgreSQL)** - Stores and processes raster data.
- **Flask (Python)** - Backend API for data retrieval.
- **React.js** - Interactive web-based front-end.
- **QGIS** - Open-source GIS tool for mapping sugarcane fields.

## 🚀 How It Works

1. **Fetch satellite imagery** from **GEE** and store NDVI data in a PostGIS database.
2. **Process spectral signatures** to classify sugarcane growth stages.
3. **Use QGIS mapping** to visualize harvest-ready areas.
4. **Display interactive maps** via a React-based web application.
