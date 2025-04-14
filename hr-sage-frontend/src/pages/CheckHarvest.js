import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  useMap,
  CircleMarker,
  Popup,
} from "react-leaflet";
import L from "leaflet"; // Importing Leaflet
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSpinner } from "@fortawesome/free-solid-svg-icons";
import "leaflet/dist/leaflet.css";
import axios from "axios";

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
      {/* Search Input */}
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

      {/* Legend with colored circles acting as toggles */}
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
            {/* Growth Stage Rows */}
            <tr
              className="cursor-pointer"
              onClick={() => handleCircleClick("Germination")}
            >
              <td className="flex items-center space-x-2">
                <span
                  className={`rounded-full w-5 h-5 ${
                    selectedStages.Germination ? "bg-red-500" : "bg-gray-300"
                  }`}
                ></span>
                <span>Germination</span>
              </td>
              <td className="text-right text-xs">(0.1 - 0.2)</td>
            </tr>
            <tr
              className="cursor-pointer"
              onClick={() => handleCircleClick("Tillering")}
            >
              <td className="flex items-center space-x-2">
                <span
                  className={`rounded-full w-5 h-5 ${
                    selectedStages.Tillering ? "bg-orange-500" : "bg-gray-300"
                  }`}
                ></span>
                <span>Tillering</span>
              </td>
              <td className="text-right text-xs">(0.2 - 0.4)</td>
            </tr>
            <tr
              className="cursor-pointer"
              onClick={() => handleCircleClick("GrandGrowth")}
            >
              <td className="flex items-center space-x-2">
                <span
                  className={`rounded-full w-5 h-5 ${
                    selectedStages.GrandGrowth ? "bg-yellow-500" : "bg-gray-300"
                  }`}
                ></span>
                <span>Grand Growth</span>
              </td>
              <td className="text-right text-xs">(0.5 - 0.7)</td>
            </tr>
            <tr
              className="cursor-pointer"
              onClick={() => handleCircleClick("Ripening")}
            >
              <td className="flex items-center space-x-2">
                <span
                  className={`rounded-full w-5 h-5 ${
                    selectedStages.Ripening ? "bg-green-500" : "bg-gray-300"
                  }`}
                ></span>
                <span>Ripening</span>
              </td>
              <td className="text-right text-xs">(0.3 - 0.5)</td>
            </tr>
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

const CheckHarvest = () => {
  const [ndviUrl, setNdviUrl] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [sugarcaneLocations, setSugarcaneLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStages, setSelectedStages] = useState({
    Germination: true,
    Tillering: true,
    GrandGrowth: true,
    Ripening: true,
  });
  const [minValidSugarcaneCount, setMinValidSugarcaneCount] = useState(20); // Minimum valid sugarcane count in a group
  const mapRef = useRef(null);

  // Define the bounds for the Philippines
  const philippinesBounds = [
    [4.5, 116.5], // Southeast (Min Lat, Min Lon)
    [21.5, 126.5], // Northwest (Max Lat, Max Lon)
  ];

  // Define minZoom level based on the bounds of the Philippines
  const minZoom = 1; // Suitable for viewing the whole Philippines

  // Distance threshold for grouping markers (in meters)
  const groupingThreshold = 5000; // Group sugarcane within 100 meters

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

  const searchLocation = async (query) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: {
            q: query,
            format: "json",
            countrycodes: "PH",
            limit: 1,
          },
        }
      );

      if (response.data.length > 0) {
        const { lat, lon } = response.data[0];
        if (mapRef.current) {
          mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 15);
        }
      } else {
        alert("Location not found. Try a different search.");
      }
    } catch (error) {
      console.error("Error searching location:", error);
    }
  };

  const handleToggleStage = (stage) => {
    setSelectedStages((prevState) => ({
      ...prevState,
      [stage]: !prevState[stage],
    }));
  };

  // Group locations based on proximity
  const groupLocations = (locations) => {
    let groups = [];
    let visited = new Set();

    for (let i = 0; i < locations.length; i++) {
      if (visited.has(i)) continue;

      let group = [locations[i]];
      visited.add(i);

      for (let j = i + 1; j < locations.length; j++) {
        if (visited.has(j)) continue;

        const dist = L.latLng(locations[i].lat, locations[i].lng).distanceTo(
          L.latLng(locations[j].lat, locations[j].lng)
        );

        if (dist < groupingThreshold) {
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

  const isValidGroup = (group) => group.length >= minValidSugarcaneCount;
  const MapBoundsAdjuster = () => {
    const map = useMap();
    useEffect(() => {
      if (map) {
        map.fitBounds(philippinesBounds, { padding: [10, 10] });
      }
    }, [map]);
    return null;
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="bg-gradient-to-b from-green-50 to-green-200 w-1/4 bg-gray-50 p-6 border-r border-gray-300 overflow-y-auto">
        <Legend
          onSearch={searchLocation}
          selectedStages={selectedStages}
          onToggleStage={handleToggleStage}
        />
      </div>

      {/* Map Section */}
      <div className="w-3/4 relative z-0">
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
            bounds={bounds || philippinesBounds} // Fallback to Philippines bounds
            ref={mapRef}
            maxBounds={philippinesBounds} // Limit panning to the Philippines
            maxZoom={24} // Restrict zooming level
            minZoom={6} // Restrict zoom out level to view only the Philippines
            maxBoundsViscosity={1.0} // Completely prevent zooming out past the max bounds
            zoom={7} // Initial zoom level
            scrollWheelZoom={true} // Enable scroll zooming if needed
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {bounds && <MapBoundsAdjuster bounds={bounds} />}
            {ndviUrl && bounds && (
              <ImageOverlay url={ndviUrl} bounds={bounds} opacity={0.7} />
            )}
            {!loading &&
              groupLocations(
                sugarcaneLocations.filter(
                  (location) => selectedStages[location.stage]
                )
              ).map((group, index) =>
                group.slice(0, 10).map((location, locIndex) => (
                  <CircleMarker
                    key={`${index}-${locIndex}`}
                    center={[location.lat, location.lng]}
                    radius={5}
                    pathOptions={{
                      color: location.color,
                      fillColor: location.color,
                      fillOpacity: 0.5,
                    }}
                  >
                    <Popup>
                      <div className="rounded-md text-center">
                        <span
                          className={`font-bold text-lg ${getTextColor(
                            location.stage
                          )}`}
                        >
                          {location.stage}
                        </span>
                        <br />
                        {location.stage === "Ripening"
                          ? "✔️ Ready for Harvest"
                          : "⏳ Not Ready"}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
              )}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default CheckHarvest;
