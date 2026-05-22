/**
 * Formatting utility functions for the Dresho application.
 * Written with high clarity and strict type-safety.
 */

/**
 * Formats an address object or string into a standardized, comma-separated string.
 * 
 * @param {Object|string} address - The address object containing line, landmark, city, and pincode, or a raw string.
 * @returns {string} The formatted address string.
 */
export function formatAddress(address) {
  if (!address) {
    return "";
  }
  if (typeof address === "string") {
    return address.trim();
  }
  
  const parts = [
    address.line,
    address.landmark,
    address.city,
    address.pincode
  ];
  
  return parts
    .map(part => (part ? String(part).trim() : ""))
    .filter(Boolean)
    .join(", ");
}

/**
 * Formats a numeric price or string containing price into Indian Rupees (INR) format.
 * 
 * @param {number|string} price - The raw price value.
 * @returns {string} Price formatted as INR (e.g. ₹1,449.00 or ₹1,449).
 */
export function formatCurrency(price) {
  if (price === undefined || price === null || price === "") {
    return "₹0";
  }
  
  // Clean string representations (e.g. remove existing commas)
  const cleanNumber = typeof price === "string" 
    ? parseFloat(price.replace(/,/g, "")) 
    : Number(price);
    
  if (isNaN(cleanNumber)) {
    return "₹0";
  }
  
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0 // Typically round to whole rupees for storefront display
  }).format(cleanNumber);
}

/**
 * Formats a Firestore Timestamp or standard JS Date into a user-friendly local date string.
 * 
 * @param {Object|Date|string} dateObj - The date object, timestamp object, or date string.
 * @param {Object} [options] - Optional configuration for Intl.DateTimeFormat.
 * @returns {string} Formatted date string (e.g. "May 20, 2026").
 */
export function formatDate(dateObj, options = {}) {
  if (!dateObj) {
    return "N/A";
  }
  
  let date;
  
  // Handle Firestore Timestamp objects (.toDate() method)
  if (typeof dateObj.toDate === "function") {
    date = dateObj.toDate();
  } else if (dateObj instanceof Date) {
    date = dateObj;
  } else {
    date = new Date(dateObj);
  }
  
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }
  
  const defaultOptions = {
    month: "short",
    day: "2-digit",
    year: "numeric",
    ...options
  };
  
  return date.toLocaleDateString("en-IN", defaultOptions);
}
