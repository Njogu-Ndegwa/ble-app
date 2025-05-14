// app/page.tsx
import { useEffect } from 'react';

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
    //   sessionStorage.removeItem('hasReloaded'); // Clean up
      window.location.replace('/assets/bledevices');  // Redirect after reload
    }
  }, []);

  return (
    <div>
      {/* Show a message during the timeout */}
      <p>Waiting for 5 seconds before reloading...</p>
    </div>
  );
}
