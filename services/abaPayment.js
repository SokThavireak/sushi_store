import crypto from "crypto";
import pool from "../config/db.js";

// Build the ABA payload – includes every field required for the hash
const buildPayload = (transactionId, amount, paymentOption = "abapay_khqr") => {
  const merchantId = process.env.ABA_MERCHANT_ID;
  const apiKey = process.env.ABA_API_KEY;
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  const reqTime = Math.floor(Date.now() / 1000).toString();

  const items = ""; // optional, base64‑encoded JSON array (empty in demo)
  const shipping = ""; // optional numeric fee (empty in demo)
  const cfirstname = "Murakami";
  const clastname = "Customer";
  const cemail = "customer@example.com";
  const cphone = "099999999";
  const type = "purchase";
  const payment_option = paymentOption; // e.g., "abapay_khqr" for QR code

  const return_url = `${baseUrl}/orders`;
  const cancel_url = "";
  const continue_success_url = "";
  const return_deeplink = "";
  const currency = "";
  const custom_fields = "";
  const return_params = "";
  const payout = "";
  const lifetime = "";
  const additional_params = "";
  const google_pay_token = "";
  const skip_success_page = "";

  // Concatenation order **must** follow PayWay's spec exactly
  const dataToHash = reqTime + merchantId + transactionId + amount + items + shipping +
    cfirstname + clastname + cemail + cphone + type + payment_option +
    return_url + cancel_url + continue_success_url + return_deeplink +
    currency + custom_fields + return_params + payout + lifetime +
    additional_params + google_pay_token + skip_success_page;

  const hash = crypto
    .createHmac("sha512", apiKey)
    .update(dataToHash)
    .digest("base64");

  return {
    hash,
    reqTime,
    merchantId,
    items,
    shipping,
    cfirstname,
    clastname,
    cemail,
    cphone,
    type,
    payment_option,
    return_url,
    cancel_url,
    continue_success_url,
    return_deeplink,
    currency,
    custom_fields,
    return_params,
    payout,
    lifetime,
    additional_params,
    google_pay_token,
    skip_success_page,
  };
};

// Public API – called from the order‑confirm controller
export const createAbaPayment = async (transactionId, amount) => {
  const payload = buildPayload(transactionId, amount);
  const apiUrl = process.env.ABA_API_URL;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ABA request failed: ${response.status} ${errText}`);
  }

  return response.json();
};
