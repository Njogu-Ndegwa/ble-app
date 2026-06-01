'use client';

import React from 'react';
import CustomerManagement from '../../customer-management/CustomerManagement';

interface EmbeddedCustomersProps {
  onBack: () => void;
}

export default function EmbeddedCustomers(_: EmbeddedCustomersProps) {
  return <CustomerManagement />;
}
