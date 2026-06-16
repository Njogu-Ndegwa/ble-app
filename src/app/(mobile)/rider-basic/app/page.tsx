import RiderApp from '../../rider/app/RiderApp';

/**
 * Rider Basic — the Rider applet without the self-service energy Top-Up entry
 * point. Granted via the `rider-basic` SA slug. It reuses the full Rider
 * component verbatim (login, stations, swaps, subscriptions, tickets, profile)
 * and only differs by hiding the Top-Up CTA + modal, for SAs that handle energy
 * top-ups through the standalone Energy Top-Up applet instead.
 */
export default function RiderBasicPage() {
  return <RiderApp showTopUp={false} />;
}
