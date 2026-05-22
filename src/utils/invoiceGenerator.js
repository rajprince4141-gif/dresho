/**
 * Client-side PDF Invoice Generator utility.
 * Renders an offscreen HTML document representing the invoice,
 * captures it with html2canvas, and exports it to jsPDF.
 */

/**
 * Generates and downloads a stylized PDF invoice for an order.
 * 
 * @param {Object} order - The order document from Firestore.
 * @param {Object} userData - The active user's details.
 * @param {Object} [sellerProfile] - Optional seller details profile.
 * @param {string} [sellerProfile.shopName="Dresho Official"] - Name of the shop.
 * @param {string} [sellerProfile.contact="Fulfilled by Dresho Logistics"] - Contact details.
 * @returns {Promise<void>} Resolves when the PDF generation and download trigger completes.
 */
export async function generateInvoicePDF(order, userData, sellerProfile = {}) {
  try {
    // Dynamic import to reduce initial bundle size and avoid server-side render crashes
    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;
    
    const invoiceDiv = document.createElement("div");
    invoiceDiv.style.width = "800px";
    invoiceDiv.style.padding = "40px";
    invoiceDiv.style.background = "#fff";
    invoiceDiv.style.color = "#000";
    invoiceDiv.style.fontFamily = "sans-serif";
    invoiceDiv.style.position = "absolute";
    invoiceDiv.style.left = "-9999px"; 
    
    const sellerName = sellerProfile.shopName || "Dresho Official";
    const sellerContact = sellerProfile.contact || "Fulfilled by Dresho Logistics";

    const itemsHtml = order.items?.map(item => `
      <tr>
        <td style="padding:16px; font-size: 13px; color: #333;">${item.name} ${item.size ? `(${item.size})` : ""}</td>
        <td style="padding:16px; text-align:center; font-size: 13px; color: #333;">${item.qty}</td>
        <td style="padding:16px; text-align:center; font-size: 13px; color: #333;">₹${Number(item.price).toFixed(2)}</td>
        <td style="padding:16px; text-align:right; font-size: 13px; color: #333;">₹${(Number(item.price) * Number(item.qty)).toFixed(2)}</td>
      </tr>
    `).join("") || "";

    const orderDateStr = order.createdAt?.toDate 
      ? order.createdAt.toDate().toLocaleDateString('en-GB') 
      : (order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : "N/A");
      
    const subtotal = order.items?.reduce((acc, i) => acc + (i.price * i.qty), 0) || 0;

    invoiceDiv.innerHTML = `
      <div style="font-family: Arial, sans-serif; color: #000; background: white; position: relative; padding-bottom: 60px;">
        
        <!-- Header Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px;">
          <h1 style="color: #1a0f91; font-size: 64px; font-weight: 500; margin: 0; letter-spacing: 2px;">Invoice</h1>
          <div style="background: #1a0f91; color: white; width: 140px; height: 140px; border-radius: 24px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 32px; font-weight: 800; font-family: 'Georgia', serif; letter-spacing: 1px;">Dresho</span>
          </div>
        </div>

        <!-- Bill To & Details -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 14px;">
          <div>
            <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800;">Bill To:</h3>
            <p style="margin: 4px 0;">${userData?.name || "Customer"}</p>
            <p style="margin: 4px 0;">${userData?.address?.line || order.address?.line || ""}, ${userData?.address?.city || order.address?.city || ""}</p>
            <p style="margin: 4px 0;">${userData?.email || order.email || userData?.phone || order.phone || "No contact info"}</p>
          </div>
          <div>
            <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; text-align: right;">Seller:</h3>
            <p style="margin: 4px 0; text-align: right;">${sellerName}</p>
            <p style="margin: 4px 0; text-align: right;">${sellerContact}</p>
          </div>
          <div style="text-align: right; margin-top: 24px;">
            <p style="margin: 4px 0;">Date: ${orderDateStr}</p>
            <p style="margin: 4px 0;">Invoice Number: ${order.trackingId}</p>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #1a0f91; color: white; text-align: left; font-size: 12px; letter-spacing: 1px;">
              <th style="padding: 16px; font-weight: 600;">ITEM DESCRIPTION</th>
              <th style="padding: 16px; text-align: center; font-weight: 600;">QUANTITY</th>
              <th style="padding: 16px; text-align: center; font-weight: 600;">PRICE</th>
              <th style="padding: 16px; text-align: right; font-weight: 600;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div style="border-bottom: 2px solid #333; margin-bottom: 20px;"></div>

        <!-- Totals Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="margin-top: 40px;">
            <p style="margin: 0; font-weight: 700; font-size: 12px;">Payment Method:</p>
            <p style="margin: 4px 0; font-size: 12px; color: #555;">${order.paymentMethod || "Cash on Delivery"}</p>
          </div>
          
          <div style="width: 320px;">
            <div style="display: flex; justify-content: space-between; padding: 4px 16px; font-size: 13px;">
              <span>Sub-Total:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 16px; font-size: 13px; margin-bottom: 12px;">
              <span>Delivery Fee:</span>
              <span>₹${(order.deliveryFee || 0).toFixed(2)}</span>
            </div>
            
            <div style="background: #1a0f91; color: white; display: flex; justify-content: space-between; padding: 12px 16px; font-size: 15px; font-weight: 600;">
              <span>Total Amount:</span>
              <span>₹${Number(order.total).toFixed(2)}</span>
            </div>
            
            <!-- Total Due block inside right column to match layout -->
            <div style="text-align: right; margin-top: 40px;">
              <p style="margin: 0; font-size: 14px; font-weight: 600;">Total Due</p>
              <p style="margin: 0; font-size: 56px; font-weight: 600; letter-spacing: -1px; color: #111;">₹${Number(order.total).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div style="border-bottom: 2px solid #333; margin-top: 20px; margin-bottom: 30px;"></div>

        <!-- Footer -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <h2 style="font-family: 'Georgia', serif; font-size: 36px; font-weight: 400; margin: 0; letter-spacing: 2px; color: #333;">THANK YOU</h2>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; font-weight: 800; color: #555;">Terms and Conditions</p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #888;">Return and exchange within 24 hours</p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #888;">Support: dresho.business@gmail.com</p>
          </div>
        </div>

        <!-- Corner decorations -->
        <div style="position: absolute; bottom: -40px; left: -40px; width: 80px; height: 80px; background: #1a0f91;"></div>
        <div style="position: absolute; bottom: -40px; right: -40px; width: 80px; height: 80px; background: #1a0f91;"></div>
      </div>
    `;
    
    document.body.appendChild(invoiceDiv);
    
    const canvas = await html2canvas(invoiceDiv, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Dresho_Invoice_${order.trackingId}.pdf`);
    
    document.body.removeChild(invoiceDiv);
  } catch (error) {
    console.error("Invoice generation error:", error);
    alert("Failed to generate and download invoice: " + error.message);
  }
}
