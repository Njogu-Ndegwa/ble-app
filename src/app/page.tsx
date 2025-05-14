'use client'

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function Index() {
  useEffect(() => {
    // Check if we've already reloaded (to prevent infinite reload)
    const hasReloaded = sessionStorage.getItem('hasReloaded');
    
    if (!hasReloaded) {
      // Mark that we've started the reload process
      sessionStorage.setItem('hasReloaded', 'true');
      
      // Set a timeout to reload the page after 5 seconds
      setTimeout(() => {
        window.location.reload(); // This will reload the page
      }, 5000);
    } else {
      // After reload, redirect to the desired page
      // sessionStorage.removeItem('hasReloaded'); // Clean up
      window.location.replace('/assets/bleDevices'); // Redirect after reload
    }
  }, []);
  
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    </div>
  );
}