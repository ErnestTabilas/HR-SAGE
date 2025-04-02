import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faBars,
  faTimes,
  faBell,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import Home from "./pages/Home";
import CheckHarvest from "./pages/CheckHarvest";

const App = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const toggleNotification = () => {
    setNotificationOpen(!notificationOpen);
  };

  return (
    <Router>
      <div className="relative">
        <div className="bg-emerald-600 shadow-md flex flex-row py-0 px-6 justify-between">
          <div className="flex items-center">
            <FontAwesomeIcon
              icon={faBars}
              className="text-white text-2xl cursor-pointer mr-4"
              onClick={toggleMenu}
            />
            {/* Logo */}
            <img
              src="/logo.png"
              alt="HR-SAGE Logo"
              className="w-16 h-14 my-4 mx-4 mr-20"
            />
            <nav className="flex items-center space-x-10 py-4">
              <Link
                to="/"
                className="px-6 py-2 text-lg font-semibold text-white hover:bg-green-500 rounded-lg transition font-thin"
              >
                Home
              </Link>
              <Link
                to="/check-harvest"
                className="px-6 py-2 text-lg font-semibold text-white hover:bg-green-500 rounded-lg transition font-thin"
              >
                Check Harvest
              </Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="px-4 py-2 rounded-lg text-black"
              />
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute right-3 top-3 text-black"
              />
            </div>
            <button onClick={toggleNotification} className="relative px-4">
              <FontAwesomeIcon
                icon={faBell}
                className="text-white text-2xl cursor-pointer"
              />
            </button>
          </div>
        </div>

        {/* Overlay */}
        {menuOpen && (
          <div
            className="fixed inset-0 bg-black opacity-50 z-10"
            onClick={toggleMenu}
          ></div>
        )}

        {/* Sliding Menu */}
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
              className="text-lg font-semibold text-white hover:bg-green-500 rounded-lg transition font-thin px-4 py-2"
              onClick={toggleMenu}
            >
              Home
            </Link>
            <Link
              to="/check-harvest"
              className="text-lg font-semibold text-white hover:bg-green-500 rounded-lg transition font-thin px-4 py-2"
              onClick={toggleMenu}
            >
              Check Harvest
            </Link>
          </nav>
        </div>

        <div className="p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/check-harvest" element={<CheckHarvest />} />
          </Routes>
        </div>

        {/* Notification Modal */}
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
                  This feature is still under development.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
};

export default App;
