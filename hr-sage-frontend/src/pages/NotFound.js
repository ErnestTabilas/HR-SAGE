import React from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";

const NotFound = () => {
  return (
    <motion.div
      className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-green-50 to-green-200 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <FontAwesomeIcon
        icon={faExclamationTriangle}
        className="text-emerald-600 text-6xl mb-6"
      />
      <h1 className="text-4xl font-semibold text-emerald-800 mb-4">
        404 - Page Not Found
      </h1>
      <p className="text-gray-600 text-center max-w-md mb-6">
        Oops! The page you are looking for doesn’t exist.<br></br> It might have
        been moved or deleted.
      </p>
      <Link
        to="/"
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg shadow transition duration-300"
      >
        Back to Home
      </Link>
    </motion.div>
  );
};

export default NotFound;
