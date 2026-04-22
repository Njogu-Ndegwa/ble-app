import { redirect } from "next/navigation";

/**
 * Thin redirect stub kept for backwards-compat with WebView deep links that
 * still point at `/rider/serviceplan1`. All rider functionality now lives under
 * `/rider/app`.
 */
export default function RiderServicePlan1Redirect() {
  redirect("/rider/app");
}
