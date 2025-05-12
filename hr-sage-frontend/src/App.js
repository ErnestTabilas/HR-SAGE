import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faBars,
  faTimes,
  faBell,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";
import Home from "./pages/Home";
import CheckHarvest from "./pages/CheckHarvest";
import AboutUs from "./pages/AboutUs";
import NotFound from "./pages/NotFound";

const App = () => {
  return (
    <Router>
      <MainContent />
    </Router>
  );
};

const MainContent = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const toggleNotification = () => {
    setNotificationOpen(!notificationOpen);
  };

  const handleSearchFocus = () => {
    setSearchDropdownOpen(true);
  };

  const handleSearchBlur = () => {
    setTimeout(() => setSearchDropdownOpen(false), 200);
  };

  const isActive = (path) =>
    location.pathname === path ? "bg-emerald-700" : "";

  return (
    <div className="relative bg-gradient-to-b from-green-50 to-green-200">
      <div className="bg-emerald-600 shadow-md flex flex-row py-0 px-6 justify-between">
        <div className="flex items-center">
          <FontAwesomeIcon
            icon={faBars}
            className="text-white text-2xl cursor-pointer mr-4"
            onClick={toggleMenu}
          />
          <img
            src="/logo.png"
            alt="HR-SAGE Logo"
            className="w-16 h-14 my-4 mx-4 mr-20"
          />
          <nav className="flex items-center space-x-5 py-4">
            <Link
              to="/"
              className={`px-6 py-2 text-lg font-semibold text-white rounded-lg transition font-thin hover:bg-emerald-700 ${isActive(
                "/"
              )}`}
            >
              Home
            </Link>
            <Link
              to="/check-harvest"
              className={`px-6 py-2 text-lg font-semibold text-white rounded-lg transition font-thin hover:bg-emerald-700 ${isActive(
                "/check-harvest"
              )}`}
            >
              Check Harvest
            </Link>
            <Link
              to="/about-us"
              className={`px-6 py-2 text-lg font-semibold text-white rounded-lg transition font-thin hover:bg-emerald-700 ${isActive(
                "/about-us"
              )}`}
            >
              About Us
            </Link>
          </nav>
        </div>
        <div className="flex items-center space-x-4 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              className="px-4 py-2 rounded-lg text-black"
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute right-3 top-3 text-black"
            />
          </div>
          <button onClick={toggleNotification} className="relative px-4">
            <FontAwesomeIcon
              icon={faBell}
              className="text-white text-2xl cursor-pointer hover:bg-emerald-700 rounded-md p-2 transition duration-300"
            />
          </button>
          {searchDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white shadow-lg rounded-lg p-4 w-64 z-50">
              <div className="flex flex-col items-center justify-center">
                <FontAwesomeIcon
                  icon={faExclamationTriangle}
                  className="text-gray-500 text-4xl mb-2"
                />
                <p className="text-gray-600 text-center">
                  The menu search feature is still under development.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-10"
          onClick={toggleMenu}
        ></div>
      )}

      <div
        className={`fixed top-0 left-0 h-full bg-emerald-600 shadow-md transform ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out z-20`}
        style={{ width: "250px" }}
      >
        <div className="flex justify-between p-4">
          <h1 className="px-4 text-4xl font-light text-white">MENU</h1>
          <div className="flex justify-center items-center">
            <FontAwesomeIcon
              icon={faTimes}
              className="rounded-full text-white font-thin text-2xl cursor-pointer hover:bg-red-500 transition font-thin px-2 py-1"
              onClick={toggleMenu}
            />
          </div>
        </div>
        <nav className="flex flex-col space-y-4 p-4">
          <Link
            to="/"
            className={`text-lg font-semibold text-white rounded-lg transition font-thin px-4 py-2 ${isActive(
              "/"
            )}`}
            onClick={toggleMenu}
          >
            Home
          </Link>
          <Link
            to="/check-harvest"
            className={`text-lg font-semibold text-white rounded-lg transition font-thin px-4 py-2 ${isActive(
              "/check-harvest"
            )}`}
            onClick={toggleMenu}
          >
            Check Harvest
          </Link>
          <Link
            to="/about-us"
            className={`text-lg font-semibold text-white rounded-lg transition font-thin px-4 py-2 ${isActive(
              "/about-us"
            )}`}
            onClick={toggleMenu}
          >
            About Us
          </Link>
        </nav>
      </div>

      <div className="flex-grow p-0">
        {/* Use motion.div to apply page transition */}
        <motion.div
          key={location.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/check-harvest" element={<CheckHarvest />} />
            <Route path="/about-us" element={<AboutUs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </div>

      {notificationOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[100]">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Notification</h2>
              <FontAwesomeIcon
                icon={faTimes}
                className="text-gray-600 cursor-pointer text-xl rounded-full px-2 py-1 hover:bg-red-500 hover:text-white"
                onClick={toggleNotification}
              />
            </div>
            <div className="flex flex-col items-center justify-center mt-4 p-6">
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                className="text-gray-500 text-4xl mb-2"
              />
              <p className="text-gray-600 text-center">
                The notification feature is still under development.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
