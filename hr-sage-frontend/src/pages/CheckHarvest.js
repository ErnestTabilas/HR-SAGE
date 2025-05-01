import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, useMap, Popup } from "react-leaflet";
import L from "leaflet";
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
  PDFDownloadLink,
  BlobProvider,
} from "@react-pdf/renderer";
import "leaflet/dist/leaflet.css";
import axios from "axios";

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

const Legend = ({ onSearch, selectedStages, onToggleStage }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const stageInfo = [
    { name: "Germination", color: "bg-red-500", range: "(0.1 - 0.2)" },
    { name: "Tillering", color: "bg-orange-500", range: "(0.2 - 0.4)" },
    { name: "Grand Growth", color: "bg-violet-500", range: "(0.5 - 0.7)" },
    { name: "Ripening", color: "bg-blue-500", range: "(0.3 - 0.5)" },
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
        <h4 className="text-lg font-bold text-green-700">
          Sugarcane Growth Stages
        </h4>
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
                  ></span>
                  {stage.name}
                </td>
                <td className="text-right text-gray-600">{stage.range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-4 rounded-xl shadow text-sm text-gray-700 space-y-2">
        <h4 className="text-lg font-bold text-green-700">About this Map</h4>
        <p>
          This map visualizes sugarcane growth stages via NDVI/EVI pixel
          overlays.
          <br />
          Click a pixel to view stage & harvest readiness.
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
        const pointsInTile = data.filter((d) => {
          return (
            d.lat < bounds.getNorth() &&
            d.lat > bounds.getSouth() &&
            d.lng > bounds.getWest() &&
            d.lng < bounds.getEast() &&
            selectedStages[d.growth_stage.trim()]
          );
        });

        const radius = 0.1;

        pointsInTile.forEach((d) => {
          const latlngPoint = map.project([d.lat, d.lng], coords.z);
          const tileOrigin = map.project(bounds.getNorthWest(), coords.z);
          const x = latlngPoint.x - tileOrigin.x;
          const y = latlngPoint.y - tileOrigin.y;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = getColor(d.growth_stage);
          ctx.fill();
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
        if (!selectedStages[d.growth_stage]) return;

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

        if (stage === "Ripening") estimatedHarvest = today;
        else if (stage === "Grand Growth")
          estimatedHarvest.setMonth(today.getMonth() + 4);
        else if (stage === "Tillering")
          estimatedHarvest.setMonth(today.getMonth() + 8);
        else if (stage === "Emergence")
          estimatedHarvest.setMonth(today.getMonth() + 11);
        else estimatedHarvest.setMonth(today.getMonth() + 13);

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

const CheckHarvest = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Initializing map...");
  const [selectedStages, setSelectedStages] = useState({
    Germination: true,
    Tillering: true,
    "Grand Growth": true,
    Ripening: true,
  });
  const [pdfData, setPdfData] = useState({
    imgData: null,
    bounds: null,
    timestamp: null,
  });

  const mapRef = useRef();

  const loadingTips = [
    "💡 Tip: Click on sugarcane points to see details.",
    "🧭 Tip: Use the search bar to zoom.",
    "🔍 Tip: Toggle stages in the legend.",
    "🌱 Germination (NDVI 0.1–0.2): Early growth.",
    "🌾 Ripening (NDVI 0.3–0.5): Ready for harvest soon.",
    "🗓️ Data updates every 5 days.",
  ];

  useEffect(() => {
    let idx = 0;
    const iv = setInterval(() => {
      idx = (idx + 1) % loadingTips.length;
      setLoadingMsg(loadingTips[idx]);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (cachedLocations) {
      setLocations(cachedLocations);
      setLoading(false);
    } else {
      axios
        .get("http://127.0.0.1:5000/sugarcane-locations")
        .then((res) => {
          const points = Array.isArray(res.data.points) ? res.data.points : [];
          cachedLocations = points;
          setLocations(points);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error loading data:", err);
          setError(true);
        });
    }
  }, []);

  const searchLocation = async (q) => {
    try {
      const r = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: { q, format: "json", countrycodes: "PH", limit: 1 },
      });
      if (r.data[0]) {
        const { lat, lon } = r.data[0];
        mapRef.current.setView([+lat, +lon], 15);
      } else {
        alert("Location not found.");
      }
    } catch (e) {
      console.error(e);
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
                Germination (NDVI 0.1–0.2)
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
                Tillering (NDVI 0.2–0.3)
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
                Grand Growth (NDVI 0.3–0.4)
              </Text>
            </View>
            <View style={pdfStyles.legendItem}>
              <View
                style={{
                  ...pdfStyles.legendColor,
                  backgroundColor: getColor("Ripening"),
                }}
              />
              <Text style={pdfStyles.legendLabel}>Ripening (NDVI 0.4–0.5)</Text>
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
    <div className="flex flex-col lg:flex-row gap-6 p-6 lg:p-12">
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
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapBoundsAdjuster />
              <PixelCanvasLayer
                data={locations}
                selectedStages={selectedStages}
              />
            </MapContainer>
            <button
              onClick={handleGenerateAndDownloadPDF}
              className="absolute top-6 right-6 bg-emerald-600 text-white px-4 py-2 rounded-lg z-50 hover:bg-emerald-700"
            >
              Download PDF
            </button>
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
