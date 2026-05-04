"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/shop");
  }, [router]);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "#FAF7F2",
      fontFamily: "'Cormorant Garamond', serif",
      color: "#14213D",
    }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 36, fontWeight: 500, letterSpacing: 6 }}>
          DRES<span style={{ color: "#B07D3A" }}>H</span>O
        </h1>
        <p style={{ fontSize: 13, color: "#5A6478", marginTop: 8, letterSpacing: 2 }}>
          Loading...
        </p>
      </div>
    </div>
  );
}
