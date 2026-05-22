/**
 * Geolocation and distance calculation utilities.
 * Implements the Haversine formula to compute distance between coordinates.
 */

/**
 * Calculates the straight-line (great-circle) distance between two points on the Earth's surface.
 * Uses the Haversine formula.
 * 
 * @param {number} lat1 - Latitude of point 1.
 * @param {number} lon1 - Longitude of point 1.
 * @param {number} lat2 - Latitude of point 2.
 * @param {number} lon2 - Longitude of point 2.
 * @returns {number} The distance in kilometers. Returns 9999 if input is invalid.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const p1Lat = parseFloat(lat1);
  const p1Lon = parseFloat(lon1);
  const p2Lat = parseFloat(lat2);
  const p2Lon = parseFloat(lon2);

  if (isNaN(p1Lat) || isNaN(p1Lon) || isNaN(p2Lat) || isNaN(p2Lon)) {
    return 9999;
  }

  const R = 6371; // Earth's mean radius in km
  const dLat = (p2Lat - p1Lat) * (Math.PI / 180);
  const dLon = (p2Lon - p1Lon) * (Math.PI / 180);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1Lat * (Math.PI / 180)) * 
    Math.cos(p2Lat * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates estimated road distance between two points by applying a road curvature multiplier.
 * 
 * @param {number} lat1 - Latitude of point 1.
 * @param {number} lon1 - Longitude of point 1.
 * @param {number} lat2 - Latitude of point 2.
 * @param {number} lon2 - Longitude of point 2.
 * @param {number} [roadFactor=1.3] - Multiplier representing typical road winding.
 * @returns {number} The estimated road distance in kilometers.
 */
export function getRoadDistance(lat1, lon1, lat2, lon2, roadFactor = 1.3) {
  const straightLineDistance = calculateHaversineDistance(lat1, lon1, lat2, lon2);
  if (straightLineDistance === 9999) {
    return 9999;
  }
  return straightLineDistance * roadFactor;
}

/**
 * Calculates delivery earnings based on distance traveled according to the official payout rule.
 * 
 * @param {number} distanceKm - The distance in kilometers.
 * @returns {number} The payout in INR.
 */
export function calculateDeliveryEarning(distanceKm) {
  if (!distanceKm || isNaN(distanceKm)) return 22; // default minimum payout
  if (distanceKm <= 3) return 22;  // 0–3 km: ₹22
  if (distanceKm <= 6) return 32;  // 3–6 km: ₹32
  return 40;                     // 6+ km:  ₹40
}
