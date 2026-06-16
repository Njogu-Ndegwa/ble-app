'use client';

import React from 'react';
import Ticketing from '../../ticketing/app/Ticketing';

interface EmbeddedTicketsProps {
  onBack: () => void;
}

// Mounts the full Ticketing applet inside the rollup shell. Like
// EmbeddedCustomers, the back-to-dashboard affordance is the rollup
// AppHeader; Ticketing owns its own list/detail/edit/create navigation.
// SA scope flows automatically via setSAScopeOverride → buildOdooHeaders.
export default function EmbeddedTickets(_: EmbeddedTicketsProps) {
  return <Ticketing />;
}
