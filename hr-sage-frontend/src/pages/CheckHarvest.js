import React, { useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSpinner } from "@fortawesome/free-solid-svg-icons";
import html2canvas from "html2canvas";
import { XCircle } from "lucide-react";

import {
  pdf,
  Document,
  Page,
  View,
  Text,
  Image as PDFImage,
  StyleSheet,
} from "@react-pdf/renderer";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";
// const TOTAL_ROWS = 912353; // FOR TESTING PURPOSES ONLY
let cachedLocations = null;

const getColor = (stage) => {
  switch (stage) {
    case "Germination":
      return "#ef4444";
    case "Tillering":
      return "#ff8c00";
    case "Grand Growth":
      return "#7F00FF";
    case "Ripening":
      return "#0000FF";
    default:
      return "#9ca3af";
  }
};

const tileLayers = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  terrain: {
    url: "https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>, <a href="https://www.stamen.com/" target="_blank">Stamen Design</a>, <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  },
  world: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
  satellite: {
    url: "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg",
    attribution:
      '&copy; CNES, Airbus DS, PlanetObserver (Contains Copernicus Data) | <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>, <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

const Legend = ({ onSearch, selectedStages, onToggleStage }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const stageInfo = [
    { name: "Germination", color: "bg-red-500", range: "(0.2 - 0.39)" },
    { name: "Tillering", color: "bg-orange-500", range: "(0.4 - 0.59)" },
    { name: "Grand Growth", color: "bg-violet-500", range: "(0.6 - 0.85)" },
    { name: "Ripening", color: "bg-blue-500", range: "(0.3 -0.7)" },
  ];

  return (
    <div className="space-y-6 px-4">
      <div className="bg-white p-4 rounded-xl shadow space-y-3">
        <h4 className="text-lg font-bold text-green-700">Search for a Place</h4>
        <div className="flex">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter a place name..."
            className="flex-grow border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => searchTerm && onSearch(searchTerm)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-r-md"
          >
            <FontAwesomeIcon icon={faSearch} />
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow space-y-2">
        <h4 className="text-lg font-bold text-green-700">Legend</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th>Stage</th>
              <th className="text-right">NDVI</th>
            </tr>
          </thead>
          <tbody>
            {stageInfo.map((stage) => (
              <tr
                key={stage.name}
                onClick={() => onToggleStage(stage.name)}
                className="cursor-pointer hover:bg-gray-100"
              >
                <td className="flex items-center gap-2 py-1">
                  <span
                    className={`w-4 h-4 rounded-full ${
                      selectedStages[stage.name] ? stage.color : "bg-gray-300"
                    }`}
                  />
                  {stage.name}
                </td>
                <td className="text-right text-gray-600 text-xs">
                  {stage.range}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-4 rounded-xl shadow text-sm text-gray-700 space-y-2">
        <h4 className="text-lg font-bold text-green-700">About this Map</h4>
        <p>
          This map visualizes sugarcane crop locations in the country and their
          respective growth stages via NDVI pixel overlays. Click a pixel to
          view stage & harvest readiness. Click on the colored ellipses on the
          Legend panel to toggle which sugarcane growth stage to display on the
          map. You can also download a PDF of map summary. Select a different
          map tileset on dropdown menu on the upper right corner of the map.
        </p>
      </div>
    </div>
  );
};

const MapBoundsAdjuster = () => {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([
      [4.5, 116.5],
      [21.5, 126.5],
    ]);
  }, [map]);
  return null;
};

const PixelCanvasLayer = ({ data = [], selectedStages }) => {
  const map = useMap();
  const layerRef = useRef();
  const popupRef = useRef();

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const CustomCanvasLayer = L.GridLayer.extend({
      createTile: function (coords) {
        const tile = document.createElement("canvas");
        tile.width = 256;
        tile.height = 256;
        const ctx = tile.getContext("2d");

        const bounds = this._tileCoordsToBounds(coords);
        const zoom = coords.z;

        // Calculate meters per pixel at this zoom level
        const centerLat = bounds.getCenter().lat;
        const metersPerPixel =
          (40075016.686 * Math.cos((centerLat * Math.PI) / 180)) /
          Math.pow(2, zoom + 8);

        // Set pixel size as 10 meters on the ground, but adjusted for map zoom
        let pixelSize = 75 / metersPerPixel;

        // Minimum visible size at zoomed out (e.g. PH fully in view)
        const minVisibleSize = 0.2;
        pixelSize = Math.max(pixelSize, minVisibleSize);

        // Simplify or aggregate data based on zoom level
        let pointsInTile = data.filter((d) => {
          return (
            d.lat < bounds.getNorth() &&
            d.lat > bounds.getSouth() &&
            d.lng > bounds.getWest() &&
            d.lng < bounds.getEast() &&
            selectedStages[d.growth_stage?.trim()]
          );
        });

        // Zoom-based clustering: aggregate points at lower zoom levels
        if (zoom <= 10) {
          // Zoom level threshold for simplification
          pointsInTile = aggregatePoints(pointsInTile, pixelSize);
        }

        // Draw points on the canvas
        pointsInTile.forEach((d) => {
          const latlngPoint = map.project([d.lat, d.lng], zoom);
          const tileOrigin = map.project(bounds.getNorthWest(), zoom);
          const x = latlngPoint.x - tileOrigin.x;
          const y = latlngPoint.y - tileOrigin.y;

          ctx.fillStyle = getColor(d.growth_stage);
          ctx.fillRect(
            x - pixelSize / 2,
            y - pixelSize / 2,
            pixelSize,
            pixelSize
          );
        });

        return tile;
      },
    });

    layerRef.current = new CustomCanvasLayer();
    layerRef.current.addTo(map);

    const handleClick = (e) => {
      const clickLatLng = e.latlng;
      const clickPoint = map.project(clickLatLng, map.getZoom());
      let minDist = Infinity;
      let closestPoint = null;

      data.forEach((d) => {
        if (!selectedStages[d.growth_stage?.trim()]) return;

        const dataPoint = map.project([d.lat, d.lng], map.getZoom());
        const dist = clickPoint.distanceTo(dataPoint);
        if (dist < minDist) {
          minDist = dist;
          closestPoint = d;
        }
      });

      const pixelThreshold = 10;
      if (closestPoint && minDist <= pixelThreshold) {
        if (popupRef.current) popupRef.current.remove();

        const stage = closestPoint.growth_stage;
        const ndvi = closestPoint.ndvi?.toFixed(2) ?? "N/A";
        const today = new Date();
        let estimatedHarvest = new Date(today);

        // Calculate estimated harvest date based on growth stage
        if (stage === "Ripening") {
          // already ready
        } else if (stage === "Grand Growth") {
          estimatedHarvest.setMonth(today.getMonth() + 4);
        } else if (stage === "Tillering") {
          estimatedHarvest.setMonth(today.getMonth() + 8);
        } else if (stage === "Emergence") {
          estimatedHarvest.setMonth(today.getMonth() + 11);
        } else {
          estimatedHarvest.setMonth(today.getMonth() + 13);
        }

        const estimatedDate = estimatedHarvest.toISOString().split("T")[0];

        const popupContent = `
          <div style="text-align:center;">
            <strong style="color:${getColor(stage)}">${stage}</strong><br/>
            ${
              stage === "Ripening" ? "✔️ Ready for Harvest" : "⏳ Not Ready"
            }<br/>
            <small>NDVI: ${ndvi} | Est. Harvest: ${estimatedDate}</small><br/>
          </div>
        `;

        popupRef.current = L.popup()
          .setLatLng([closestPoint.lat, closestPoint.lng])
          .setContent(popupContent)
          .openOn(map);
      }
    };

    map.on("click", handleClick);

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
      map.off("click", handleClick);
    };
  }, [data, selectedStages, map]);

  return null;
};

// Helper function for aggregating points at low zoom levels
const aggregatePoints = (points, pixelSize) => {
  // Logic to aggregate nearby points (e.g., by averaging their positions)
  // or grouping them into larger pixels for lower zoom levels
  // For simplicity, we return the points unchanged for now
  return points;
};

function TileLayerSwitcher({ selectedLayer }) {
  const map = useMap();

  return (
    <TileLayer
      url={tileLayers[selectedLayer].url}
      attribution={tileLayers[selectedLayer].attribution}
    />
  );
}

const CheckHarvest = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [basemap, setBasemap] = useState("street");
  const [searchHighlight, setSearchHighlight] = useState(null);
  const [page, setPage] = useState(0); // Track page number
  const [hasMore, setHasMore] = useState(true); // Track if there are more pages to load
  const [loadingMsg, setLoadingMsg] = useState("Initializing map...");
  const [selectedStages, setSelectedStages] = useState({
    Germination: true,
    Tillering: true,
    "Grand Growth": true,
    Ripening: true,
  });

  const mapRef = useRef();

  const loadingTips = [
    "⏳ Please wait patiently as large data is being loaded.",
    "🕒 Loading may take 2-3 minutes.",
    "💡 Tip: Click on sugarcane points to see details.",
    "🔎 Tip: Use the search bar to zoom.",
    "🔴🟠🟣🔵 Tip: Toggle stages in the legend.",
    "🗺️ Tip: Change map tileset on the dropdown menu on the upper right corner.",
    "🔃 Tip: If the map fails to load within 5 mins. Reload the page.",
    "🌱 Germination (NDVI = 0.2–0.4): Early growth.",
    "🌾 Ripening: Ready for harvest soon.",
    "🗓️ Data updates every 5 days.",
  ];

  const lastDate = new Date(lastUpdated); // 'lastUpdate' is in 'yyyy-mm-dd'
  const now = new Date();

  // Strip time to compare pure date values
  lastDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  // Calculate days since last update
  const diffInMs = now - lastDate;
  const daysSinceUpdate = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  // Days remaining until next 5-day cycle
  const daysRemaining = 5 - (daysSinceUpdate % 5 || 5); // returns 5 if 0
  useEffect(() => {
    let idx = 0;
    const iv = setInterval(() => {
      idx = (idx + 1) % loadingTips.length;
      setLoadingMsg(loadingTips[idx]);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      let allData = [];
      let currentPage = 0;
      let hasMoreData = true;
      // Check if more data is available (allData != TOTAL_ROWS)
      while (hasMoreData) {
        try {
          const res = await axios.get(`${API_BASE_URL}/sugarcane-locations`, {
            params: { page: currentPage },
            timeout: 5000000, // 5000 seconds
          });

          const points = Array.isArray(res.data.points) ? res.data.points : [];

          if (points.length === 0) {
            console.log("All data successfully loaded.");
            hasMoreData = false; // No more data to load
          } else {
            allData = [...allData, ...points];
            setLocations(allData);
            console.log(
              `Page ${currentPage} fetched (${points.length} rows). Total: ${allData.length}`
            );
          }

          // Check if there is more data to load
          hasMoreData = Boolean(res.data.has_more);
          currentPage += 1; // Move to the next page

          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (err) {
          console.error("Error loading data:", err);
          setError(true);
          break;
        }
      }

      setLoading(false);
    };

    if (!cachedLocations) {
      fetchAllData();
    } else {
      setLocations(cachedLocations);
      setLoading(false);
    }
  }, []);

  // useEffect(() => {
  //   fetch(`${API_BASE_URL}/api/last-update`)
  //     .then((res) => res.json())
  //     .then((data) => {
  //       if (data.last_updated) {
  //         setLastUpdated(data.last_updated);
  //       }
  //     })
  //     .catch((err) => console.error("Failed to fetch last update:", err));
  // }, []);

  const searchLocation = async (query) => {
    setLoadingMsg(`Searching for "${query}"...`);

    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}`
      );

      if (response.data.length > 0) {
        const result = response.data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        const map = mapRef.current;
        if (map) {
          map.flyTo([lat, lon], 13);

          const bounds = [
            [lat - 0.01, lon - 0.01],
            [lat + 0.01, lon + 0.01],
          ];

          // Filter sugarcane points in bounding box
          const pointsInArea = locations.filter(
            (p) =>
              p.lat > bounds[0][0] &&
              p.lat < bounds[1][0] &&
              p.lng > bounds[0][1] &&
              p.lng < bounds[1][1]
          );

          // Show yellow transparent highlight and popup
          const layer = L.rectangle(bounds, {
            color: "yellow",
            weight: 2,
            fillOpacity: 0.25,
          }).addTo(map);

          const popup = L.popup()
            .setLatLng([lat, lon])
            .setContent(
              `<strong>${pointsInArea.length}</strong> sugarcane points found nearby.`
            )
            .openOn(map);

          setSearchHighlight({ layer, popup });

          // Remove highlight after 5 seconds
          setTimeout(() => {
            map.removeLayer(layer);
            map.closePopup(popup);
            setSearchHighlight(null);
          }, 5000);
        }
      } else {
        alert("No location found.");
      }
    } catch (err) {
      console.error("Search failed:", err);
      alert("Search failed. Please try again.");
    }
  };

  const toggleStage = (stage) =>
    setSelectedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));

  const pdfStyles = StyleSheet.create({
    page: { padding: 30, fontFamily: "Helvetica", backgroundColor: "#f0fdf4" },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "#047857",
      padding: 10,
      borderRadius: 6,
      marginBottom: 12,
    },
    logo: { width: 50, height: 50 },
    headerTextContainer: { flexDirection: "column", justifyContent: "center" },
    title: { fontSize: 18, color: "white", fontWeight: 700 },
    timestamp: { fontSize: 10, color: "#d1fae5" },
    infoRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "flex-start",
      marginBottom: 10,
      gap: 20,
    },
    legendContainer: {
      padding: 10,
      backgroundColor: "#ecfdf5",
      borderRadius: 6,
      minWidth: "50%",
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    legendColor: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 6,
    },
    legendLabel: { fontSize: 10, color: "#065f46" },
    bboxContainer: {
      padding: 10,
      backgroundColor: "#ecfdf5",
      borderRadius: 4,
      minWidth: "40%",
    },
    legendTitle: {
      fontSize: 12,
      fontWeight: 600,
      color: "#065f46",
      paddingBottom: 8,
    },
    bbox: { fontSize: 10, color: "#065f46" },
    mapImage: {
      width: "100%",
      marginTop: 12,
      borderRadius: 6,
      border: "1pt solid #047857", // Tailwind: border border-emerald-700
    },
  });

  const MapPDFDocument = ({ imgData, bounds, timestamp }) => (
    <Document>
      <Page size="A4" style={pdfStyles.page} orientation="portrait">
        <View style={pdfStyles.header}>
          <PDFImage src="logo.png" style={pdfStyles.logo} />
          <View style={pdfStyles.headerTextContainer}>
            <Text style={pdfStyles.title}>HR‑SAGE Sugarcane Map</Text>
            <Text style={pdfStyles.timestamp}>Generated: {timestamp}</Text>
          </View>
        </View>

        <View style={pdfStyles.infoRow}>
          <View style={pdfStyles.legendContainer}>
            <Text style={pdfStyles.legendTitle}>
              Legend: Sugarcane Growth Stages
            </Text>
            <View style={pdfStyles.legendItem}>
              <View
                style={{
                  ...pdfStyles.legendColor,
                  backgroundColor: getColor("Germination"),
                }}
              />
              <Text style={pdfStyles.legendLabel}>
                Germination (NDVI 0.2–0.39)
              </Text>
            </View>
            <View style={pdfStyles.legendItem}>
              <View
                style={{
                  ...pdfStyles.legendColor,
                  backgroundColor: getColor("Tillering"),
                }}
              />
              <Text style={pdfStyles.legendLabel}>
                Tillering (NDVI 0.4–0.59)
              </Text>
            </View>
            <View style={pdfStyles.legendItem}>
              <View
                style={{
                  ...pdfStyles.legendColor,
                  backgroundColor: getColor("Grand Growth"),
                }}
              />
              <Text style={pdfStyles.legendLabel}>
                Grand Growth (NDVI 0.6–0.79)
              </Text>
            </View>
            <View style={pdfStyles.legendItem}>
              <View
                style={{
                  ...pdfStyles.legendColor,
                  backgroundColor: getColor("Ripening"),
                }}
              />
              <Text style={pdfStyles.legendLabel}>
                Ripening HARVEST-READY (NDVI 0.8-above)
              </Text>
            </View>
          </View>

          <View style={pdfStyles.bboxContainer}>
            <Text style={pdfStyles.legendTitle}>Map Bounds</Text>
            <Text style={pdfStyles.bbox}>
              Northeast: {bounds.getNorthEast().lat.toFixed(4)},{" "}
              {bounds.getNorthEast().lng.toFixed(4)}
            </Text>
            <Text style={pdfStyles.bbox}>
              Southwest: {bounds.getSouthWest().lat.toFixed(4)},{" "}
              {bounds.getSouthWest().lng.toFixed(4)}
            </Text>
          </View>
        </View>

        <PDFImage src={imgData} style={pdfStyles.mapImage} />
      </Page>
    </Document>
  );

  const PH_BOUNDS = [
    [4.5, 116.5],
    [21.5, 126.5],
  ];

  const handleGenerateAndDownloadPDF = async () => {
    const mapEl = document.querySelector(".leaflet-container");
    if (!mapEl) return;
    const canvas = await html2canvas(mapEl, { useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const bounds = mapRef.current.getBounds();
    const timestamp = new Date().toLocaleString();
    const doc = (
      <MapPDFDocument imgData={imgData} bounds={bounds} timestamp={timestamp} />
    );
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sugarcane_map_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 lg:p-12 h-screen">
      <div className="lg:w-1/4">
        <Legend
          onSearch={searchLocation}
          selectedStages={selectedStages}
          onToggleStage={toggleStage}
        />
      </div>

      <div className="w-3/4 relative z-0">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-xl shadow bg-opacity-80 z-10">
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className="text-emerald-600 text-4xl mb-3"
            />
            <p className="text-lg font-medium text-gray-600 text-center p-6">
              {loadingMsg}
            </p>
          </div>
        ) : (
          <div className="relative w-full h-full bg-white rounded-xl shadow">
            <MapContainer
              ref={mapRef}
              style={{ height: "100vh", width: "100%" }}
              bounds={PH_BOUNDS}
              maxBounds={PH_BOUNDS}
              zoom={7}
              minZoom={6}
              maxZoom={24}
              scrollWheelZoom={true}
              className="z-0"
            >
              <MapBoundsAdjuster />
              <TileLayerSwitcher selectedLayer={basemap} />
              <PixelCanvasLayer
                data={locations}
                selectedStages={selectedStages}
                className="z-50"
              />
            </MapContainer>
            <button
              onClick={handleGenerateAndDownloadPDF}
              className="absolute top-4 right-24 bg-red-900 text-white px-4 py-2 rounded-lg z-50 hover:bg-emerald-700"
            >
              Download PDF
            </button>
            {/* <div className="absolute top-6 left-14 text-xs text-gray-600 bg-white px-3 py-1 rounded shadow z-50">
              📅 Last Updated at: {lastUpdated}, Next update after{" "}
              {daysRemaining} days
            </div> */}
            <div className="absolute top-4 right-4 bg-white p-1 w-45 rounded shadow z-[999] text-gray-600">
              <select
                className="ml-1 border px-2 py-1 rounded"
                value={basemap}
                onChange={(e) => setBasemap(e.target.value)}
              >
                <option value="terrain">🏔️</option>
                <option value="world">🌍</option>
                <option value="satellite">🛰️</option>
                <option value="street">🚗</option>
                <option value="dark">🌙</option>
              </select>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-[1000]">
            <div className="text-center">
              <XCircle className="mx-auto text-red-500 w-12 h-12" />
              <p className="text-lg font-medium text-red-600 text-center pt-6 px-6">
                Failed to load sugarcane data.
              </p>
              <p className="text-gray-500">Please reload the page.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckHarvest;
