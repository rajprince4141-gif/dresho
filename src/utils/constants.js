/**
 * Global application constants and configuration.
 * Avoids hardcoding magic values and strings throughout the codebase.
 */

export const APP_CONFIG = {
  STORE_NAME: "Dresho",
  SUPPORT_EMAIL: "dresho.business@gmail.com",
  
  // Commission settings
  COMMISSION_RATE: 0.15, // 15% platform commission
  
  // Delivery config
  DEFAULT_DELIVERY_FEE: 40, // Base delivery charge in INR
  DELIVERY_FEE_FREE_THRESHOLD: 499, // Cart total threshold for free delivery
  MIN_DELIVERY_TIME_MINS: 10,
  MAX_DELIVERY_TIME_MINS: 90,
  DEFAULT_DELIVERY_TIME_MINS: 45,
  RIDER_MAX_DISTANCE_KM: 4.0, // Maximum distance a rider can be from customer to be considered nearby
  
  // Payment keys & integration
  RAZORPAY_DEFAULT_KEY: "rzp_test_SfdWyoWv6wqHiT",
  
  // User roles
  ROLES: {
    CUSTOMER: "user",
    SELLER: "seller",
    RIDER: "delivery",
    ADMIN: "admin"
  },
  
  // Order statuses
  ORDER_STATUS: {
    PLACED: "PLACED",
    ACCEPTED: "ACCEPTED", // by seller
    PACKED: "PACKED",     // by seller
    ASSIGNED: "ASSIGNED", // rider assigned
    PICKED_UP: "PICKED_UP", // by rider
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
    CANCELLED: "CANCELLED",
    RETURN_REQUESTED: "Return Requested",
    EXCHANGE_REQUESTED: "Exchange Requested"
  }
};

/**
 * List of verified administrator email addresses.
 */
export const ADMIN_EMAILS = [
  "prinxadmin29@gmail.com",
  "krishnaprakash0016@gmail.com"
];
