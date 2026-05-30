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

/**
 * Calculates discount, final price, and original price (MRP) for any product.
 * If the product doesn't have an explicit MRP higher than its price,
 * it applies a standard 38% fallback discount.
 * 
 * @param {Object} product - The product object
 * @returns {Object} { mrp: number, price: number, discount: number }
 */
export function getProductPricing(product) {
  if (!product) {
    return { mrp: 0, price: 0, discount: 0 };
  }
  const rawPrice = Number(String(product.price).replace(/,/g, "")) || 0;
  
  if (product.mrp && Number(String(product.mrp).replace(/,/g, "")) > rawPrice) {
    const rawMrp = Number(String(product.mrp).replace(/,/g, ""));
    return {
      mrp: rawMrp,
      price: rawPrice,
      discount: Math.round(((rawMrp - rawPrice) / rawMrp) * 100)
    };
  }
  
  return {
    mrp: rawPrice,
    price: Math.round(rawPrice * 0.62), // 38% off
    discount: 38
  };
}

