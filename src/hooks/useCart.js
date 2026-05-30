import { useState, useCallback } from "react";
import { getProductPricing } from "@/utils/formatters";

/**
 * Custom React Hook to manage Dresho customer cart operations.
 * 
 * @param {Object} user - The logged-in customer object (from useAuth)
 * @param {Function} setShowAuth - State setter to show the login modal if unauthenticated
 */
export function useCart(user, setShowAuth) {
  const [cart, setCart] = useState([]);

  const addToCart = useCallback((product, size) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    
    // Resolve dynamic discount price to ensure cart, checkout and invoices are consistent!
    const pricing = getProductPricing(product);
    const productWithPricing = {
      ...product,
      price: pricing.price,
      mrp: pricing.mrp
    };

    setCart((prev) => {
      const key = product.id + (size || "");
      const existing = prev.find((item) => item.id + (item.selectedSize || "") === key);
      if (existing) {
        return prev.map((item) =>
          item.id + (item.selectedSize || "") === key
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, { ...productWithPricing, qty: 1, selectedSize: size || "M" }];
    });
  }, [user, setShowAuth]);

  const changeQty = useCallback((index, delta) => {
    setCart((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index].qty += delta;
        if (updated[index].qty <= 0) {
          updated.splice(index, 1);
        }
      }
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Compute total price (removing any string comma formatting)
  const cartTotal = cart.reduce((sum, item) => {
    const priceStr = String(item.price).replace(/,/g, "");
    return sum + (Number(priceStr) * item.qty);
  }, 0);

  // Compute total item count
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return {
    cart,
    setCart,
    addToCart,
    changeQty,
    clearCart,
    cartTotal,
    cartCount
  };
}
