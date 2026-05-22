import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

/**
 * Custom hook to listen to products in real-time.
 * 
 * @param {Object} options - Configuration options
 * @param {string} [options.sellerId] - Optional seller ID to filter products for a specific seller
 */
export function useProducts(options = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const sellerId = options?.sellerId;

  useEffect(() => {
    let q;
    if (sellerId) {
      q = query(collection(db, "products"), where("sellerId", "==", sellerId));
    } else {
      q = collection(db, "products");
    }

    const unsub = onSnapshot(q, (snap) => {
      let p = [];
      snap.forEach((d) => p.push({ id: d.id, ...d.data() }));

      // If fetching all products (customer-facing shop), sort by creation date
      if (!sellerId) {
        p.sort((a, b) => {
          const aTime = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        // Mock products fallback for client storefront demo
        if (p.length === 0) {
          p = [
            { id: "mock1", name: "Royal Blue Embroidered Kurta", price: 2499, category: "Ethnic", image: "https://images.unsplash.com/photo-1583391733958-d25e07fac04f?w=600&q=80", sizes: ["S", "M", "L"] },
            { id: "mock2", name: "Banarasi Silk Saree", price: 4999, category: "Ethnic", image: "https://images.unsplash.com/photo-1610189013230-6db19c4d92a1?w=600&q=80", sizes: ["Free Size"] },
            { id: "mock3", name: "Premium Leather Jacket", price: 3999, category: "Men's Wear", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80", sizes: ["M", "L", "XL"] },
            { id: "mock4", name: "Classic White Sneakers", price: 2999, category: "Footwear", image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=80", sizes: ["7", "8", "9", "10"] },
            { id: "mock5", name: "Floral Print Maxi Dress", price: 1899, category: "Ethnic", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80", sizes: ["XS", "S", "M", "L"] },
            { id: "mock6", name: "Minimalist Gold Necklace", price: 5999, category: "Ethnic", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80", sizes: ["One Size"] }
          ];
        }
      }

      setProducts(p);
      setLoading(false);
    }, (err) => {
      console.error("Error listening to products:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [sellerId]);

  return { products, loading };
}
