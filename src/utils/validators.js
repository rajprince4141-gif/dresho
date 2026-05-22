/**
 * Validation utilities for user input fields.
 * Provides consistent validation rules across customer, seller, and delivery panels.
 */

/**
 * Validates whether the given string is a valid Indian PIN code (6 digits).
 * 
 * @param {string|number} pincode - The PIN code to check.
 * @returns {boolean} True if the PIN code is valid.
 */
export function isValidPincode(pincode) {
  if (!pincode) return false;
  const pinStr = String(pincode).trim();
  // Indian PIN codes are exactly 6 digits, not starting with 0
  const pinRegex = /^[1-9][0-9]{5}$/;
  return pinRegex.test(pinStr);
}

/**
 * Validates whether the given string is a valid Indian mobile number (10 digits).
 * Supports optional prefix "+91" or "0".
 * 
 * @param {string|number} phone - The phone number to check.
 * @returns {boolean} True if valid.
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const phoneStr = String(phone).replace(/[\s-]/g, "").trim();
  // Regex matches standard 10-digit Indian mobile numbers with optional country code prefix
  const phoneRegex = /^(?:\+91|91|0)?[6-9][0-9]{9}$/;
  return phoneRegex.test(phoneStr);
}

/**
 * Validates standard email address formats.
 * 
 * @param {string} email - The email to check.
 * @returns {boolean} True if valid.
 */
export function isValidEmail(email) {
  if (!email) return false;
  const emailStr = String(email).trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(emailStr);
}
