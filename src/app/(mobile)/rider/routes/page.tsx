'use client'

import React, { useState, useRef, useEffect } from 'react';
import ChargingStationFinder from './ChargingStationFinder';
import { Toaster, toast } from 'react-hot-toast';
import { useBridge } from '@/app/context/bridgeContext';
import { LogIn } from 'lucide-react';


// Define interfaces and types
export interface BleDevice {
  macAddress: string;
  name: string;
  rssi: string;
  rawRssi: number;
  imageUrl?: string;
  firmwareVersion?: string;
  deviceId?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
  locationName?: string;
  [key: string]: any;
}

interface WebViewJavascriptBridge {
  init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

const AppContainer = () => {
  const [isLocationListenerActive, setIsLocationListenerActive] = useState<boolean>(false);
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationData | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false); // State to toggle sign-in view
  const bridgeInitRef = useRef(false);
  const { bridge } = useBridge();

  // Validate coordinates
  const hasValidCoordinates = (location: LocationData | null) => {
    return (
      location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      !isNaN(location.latitude) &&
      !isNaN(location.longitude) &&
      location.latitude !== 0 &&
      location.longitude !== 0 &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  };

  // Initialize bridge and set up location callback
  useEffect(() => {
    if (!bridge || bridgeInitRef.current) return;

    const setupBridge = (bridge: WebViewJavascriptBridge) => {
      bridgeInitRef.current = true;

      try {
        bridge.init((_m, r) => r('js success!'));
      } catch (error) {
        console.error("Error initializing bridge:", error);
      }

      const noop = () => {};
      const reg = (name: string, handler: any) => {
        bridge.registerHandler(name, handler);
        return () => bridge.registerHandler(name, noop);
      };

      const offPrint = reg('print', (data: string, resp: any) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed?.data) resp(parsed.data);
          else throw new Error('Parsed data is not in the expected format.');
        } catch (err) {
          console.error("Error parsing JSON in 'print':", err);
        }
      });

      const offLocationCallback = reg(
        "locationCallBack",
        (data: string, responseCallback: (response: any) => void) => {
          try {
            const rawLocationData = typeof data === 'string' ? JSON.parse(data) : data;

            if (!rawLocationData || typeof rawLocationData !== 'object') {
              toast.error("Invalid location data format");
              responseCallback({ success: false, error: "Invalid format" });
              return;
            }

            const { latitude, longitude } = rawLocationData;

            if (
              typeof latitude !== 'number' ||
              typeof longitude !== 'number' ||
              isNaN(latitude) ||
              isNaN(longitude)
            ) {
              toast.error("Invalid coordinates: Must be valid numbers");
              responseCallback({ success: false, error: "Invalid coordinates" });
              return;
            }

            const locationData: LocationData = {
              latitude,
              longitude,
              timestamp: rawLocationData.timestamp || Date.now(),
              locationName: rawLocationData.locationName,
            };

            if (!hasValidCoordinates(locationData)) {
              if (latitude === 0 && longitude === 0) {
                toast.error("Location at (0,0) - possible GPS error");
              } else {
                toast.error("Coordinates out of valid range");
              }
              responseCallback({ success: false, error: "Invalid coordinates" });
              return;
            }

            setLastKnownLocation(locationData);
            setIsLocationListenerActive(true);
            console.log("Location callback received:", locationData);
            responseCallback({ success: true, location: locationData });
          } catch (error) {
            toast.error("Error processing location data");
            console.error("Error in location callback:", error);
            responseCallback({ success: false, error: String(error) });
          }
        }
      );

      return () => {
        offPrint();
        offLocationCallback();
      };
    };

    if (bridge) {
      return setupBridge(bridge);
    }

    return () => {};
  }, [bridge]);

  // Start location listener automatically when bridge is available
  useEffect(() => {
    if (bridge && bridgeInitRef.current) {
      console.info("Requesting to start location listener");
      toast.loading("Starting location listener...", { id: 'location-loading' });

      bridge.callHandler(
        'startLocationListener',
        {},
        (responseData) => {
          try {
            const parsedResponse = JSON.parse(responseData);
            toast.dismiss('location-loading');

            if (parsedResponse?.respCode === "200") {
              setIsLocationListenerActive(true);
              // toast.success("Location tracking started");
            } else {
              setIsLocationListenerActive(false);
              toast.error(`Failed to start: ${parsedResponse?.respMessage || 'Unknown error'}`);
            }
          } catch (error) {
            toast.dismiss('location-loading');
            toast.error("Invalid response from location service");
            console.error("Error parsing start location response:", error);
          }
        }
      );
    }
  }, [bridge, bridgeInitRef.current]);

  // Handle sign-in button click
  const handleSignIn = () => {
    setIsSignedIn(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: 'white',
            },
          },
        }}
      />
       {!isSignedIn ? (
        <button
          onClick={handleSignIn}
          className="bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 transition-colors duration-200"
        >
          <LogIn className="w-6 h-6" />
          Sign in
        </button>
      ) : (
        <ChargingStationFinder
          userLocation={lastKnownLocation}
          isLocationActive={isLocationListenerActive}
          lastKnownLocation={lastKnownLocation}
        />
      )}
    </div>
  );
};

export default AppContainer;