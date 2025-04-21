import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  useMap,
  useMapEvents,
  CircleMarker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSpinner } from "@fortawesome/free-solid-svg-icons";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import debounce from "lodash.debounce";

const getTextColor = (growthStage) => {
  switch (growthStage) {
    case "Germination":
      return "text-red-500";
    case "Tillering":
      return "text-orange-500";
    case "Grand Growth":
      return "text-yellow-500";
    case "Ripening":
      return "text-green-500";
    default:
      return "text-gray-500";
  }
};

const Legend = ({ onSearch, selectedStages, onToggleStage }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = () => {
    if (searchTerm.trim() !== "") {
      onSearch(searchTerm);
    }
  };

  const handleCircleClick = (stage) => {
    onToggleStage(stage);
  };

  return (
    <div className="space-y-4 px-4">
      <div className="bg-white p-5 shadow-md rounded-lg">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          Search for a Place
        </h4>
        <div className="flex items-center ">
          <input
            type="text"
            placeholder="Enter a place name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-2 rounded-l-md w-full p-2 focus:outline-none focus:ring focus:border-emerald-500"
          />
          <button
            onClick={handleSearch}
            className="bg-emerald-600 px-3 py-2 rounded-r-md hover:bg-emerald-700"
          >
            <FontAwesomeIcon icon={faSearch} className="text-white py-1" />
          </button>
        </div>
      </div>

      <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          Sugarcane Growth Stages
        </h4>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-gray-700 font-semibold pb-2">
                Stage
              </th>
              <th className="text-right text-gray-700 font-semibold pb-2">
                NDVI Value
              </th>
            </tr>
          </thead>
          <tbody>
            {["Germination", "Tillering", "GrandGrowth", "Ripening"].map(
              (stage) => (
                <tr
                  key={stage}
                  className="cursor-pointer"
                  onClick={() => handleCircleClick(stage)}
                >
                  <td className="flex items-center space-x-2">
                    <span
                      className={`rounded-full w-5 h-5 ${
                        selectedStages[stage]
                          ? {
                              Germination: "bg-red-500",
                              Tillering: "bg-orange-500",
                              GrandGrowth: "bg-yellow-500",
                              Ripening: "bg-green-500",
                            }[stage]
                          : "bg-gray-300"
                      }`}
                    ></span>
                    <span>{stage.replace("GrandGrowth", "Grand Growth")}</span>
                  </td>
                  <td className="text-right text-xs">
                    {
                      {
                        Germination: "(0.1 - 0.2)",
                        Tillering: "(0.2 - 0.4)",
                        GrandGrowth: "(0.5 - 0.7)",
                        Ripening: "(0.3 - 0.5)",
                      }[stage]
                    }
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          About this Map
        </h4>
        <p className="text-sm text-gray-600 leading-relaxed">
          This map visualizes the sugarcane farm growth stages based on NDVI.
          The colors represent different stages of growth. You can click on the
          ellipses on the Legend panel to select which crop stage are visible on
          the map. Clicking an ellipse on the map will show you the selected
          crop's growth stage and harvest readiness. You can also search for
          places in the Philippines using the search function.
        </p>
      </div>
    </div>
  );
};

const MapBoundsAdjuster = () => {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.fitBounds([
        [4.5, 116.5],
        [21.5, 126.5],
      ]);
    }
  }, [map]);
  return null;
};

const ZoomWatcher = ({ setZoom }) => {
  useMapEvents({
    zoomend: debounce((e) => {
      setZoom(e.target.getZoom());
    }, 250),
  });
  return null;
};

const CheckHarvest = () => {
  const [sugarcaneLocations, setSugarcaneLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(7);
  const [selectedStages, setSelectedStages] = useState({
    Germination: true,
    Tillering: true,
    GrandGrowth: true,
    Ripening: true,
  });
  const [minValidSugarcaneCount, setMinValidSugarcaneCount] = useState(20);
  const mapRef = useRef(null);
  const [visibleBounds, setVisibleBounds] = useState(null);

  const philippinesBounds = [
    [4.5, 116.5],
    [21.5, 126.5],
  ];

  const getDynamicThreshold = (zoom) => {
    if (zoom >= 16) return 500;
    if (zoom >= 14) return 1500;
    if (zoom >= 12) return 3000;
    if (zoom >= 10) return 5000;
    return 10000;
  };

  useEffect(() => {
    setLoading(true);
    axios
      .get("http://127.0.0.1:5000/sugarcane-locations")
      .then((response) => {
        const locations = Array.isArray(response.data) ? response.data : [];
        setSugarcaneLocations(locations);
        setLoading(false);
      })
      .catch((error) =>
        console.error("Error fetching sugarcane locations:", error)
      );
  }, []);

  const handleToggleStage = (stage) => {
    setSelectedStages((prevState) => ({
      ...prevState,
      [stage]: !prevState[stage],
    }));
  };

  const getClusters = (locations) => {
    const groups = [];
    const visited = new Set();
    const threshold = getDynamicThreshold(zoomLevel);

    for (let i = 0; i < locations.length; i++) {
      if (visited.has(i)) continue;
      let group = [locations[i]];
      visited.add(i);
      for (let j = i + 1; j < locations.length; j++) {
        if (visited.has(j)) continue;
        const dist = L.latLng(locations[i].lat, locations[i].lng).distanceTo(
          L.latLng(locations[j].lat, locations[j].lng)
        );
        if (dist < threshold) {
          group.push(locations[j]);
          visited.add(j);
        }
      }
      if (group.length >= minValidSugarcaneCount) {
        groups.push(group);
      }
    }

    return groups;
  };

  const mapVisibleClusters = () => {
    if (!visibleBounds) return [];

    const bounds = L.latLngBounds(visibleBounds);
    const filtered = sugarcaneLocations.filter(
      (loc) =>
        selectedStages[loc.stage] && bounds.contains(L.latLng(loc.lat, loc.lng))
    );

    return getClusters(filtered);
  };

  const ZoomWatcher = () => {
    useMapEvents({
      zoomend: (e) => {
        setZoomLevel(e.target.getZoom());
      },
      moveend: (e) => {
        setVisibleBounds(e.target.getBounds());
      },
    });
    return null;
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="bg-gradient-to-b from-green-50 to-green-200 w-1/4 p-6 border-r border-gray-300 overflow-y-auto">
        <Legend
          onSearch={(query) => {
            axios
              .get(`https://nominatim.openstreetmap.org/search`, {
                params: {
                  q: query,
                  format: "json",
                  countrycodes: "PH",
                  limit: 1,
                },
              })
              .then((response) => {
                if (response.data.length > 0) {
                  const { lat, lon } = response.data[0];
                  mapRef.current.setView(
                    [parseFloat(lat), parseFloat(lon)],
                    15
                  );
                }
              });
          }}
          selectedStages={selectedStages}
          onToggleStage={handleToggleStage}
        />
      </div>

      {/* Map */}
      <div className="w-3/4 relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-70 z-10">
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className="text-emerald-600 text-4xl mb-3"
            />
            <p className="text-lg font-semibold text-gray-700">
              Loading NDVI data...
            </p>
          </div>
        ) : (
          <MapContainer
            style={{ height: "100vh", width: "100%" }}
            bounds={philippinesBounds}
            ref={mapRef}
            zoom={7}
            maxZoom={24}
            minZoom={6}
            maxBounds={philippinesBounds}
            maxBoundsViscosity={1.0}
            scrollWheelZoom={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ZoomWatcher />
            <MapBoundsAdjuster />

            {/* Render only one marker per cluster */}
            {mapVisibleClusters().map((group, idx) => {
              const center = group[0]; // pick the first point in the cluster
              return (
                <CircleMarker
                  key={idx}
                  center={[center.lat, center.lng]}
                  radius={5}
                  pathOptions={{
                    color: center.color,
                    fillColor: center.color,
                    fillOpacity: 0.5,
                  }}
                >
                  <Popup>
                    <div className="text-center">
                      <span
                        className={`font-bold text-lg ${getTextColor(
                          center.stage
                        )}`}
                      >
                        {center.stage}
                      </span>
                      <br />
                      {center.stage === "Ripening"
                        ? "✔️ Ready for Harvest"
                        : "⏳ Not Ready"}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default CheckHarvest;
