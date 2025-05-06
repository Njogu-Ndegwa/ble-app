'use client'

import React, { useEffect, useState, useRef } from 'react';
import { MapPin, Clock } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
  locationName?: string;
  [key: string]: any;
}

interface LocationViewProps {
  isLocationActive: boolean;
  handleStartLocationListener: () => void;
  handleStopLocationListener: () => void;
  handleGetLastLocation: () => void;
  lastKnownLocation: LocationData | null;
}

const LocationView: React.FC<LocationViewProps> = ({
  isLocationActive,
  handleStartLocationListener,
  handleStopLocationListener,
  handleGetLastLocation,
  lastKnownLocation,
}) => {
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
  const [locationName, setLocationName] = useState<string>('');
  const [nextUpdateTime, setNextUpdateTime] = useState<string>('');
  const initialized = useRef(false);
  const processingLocation = useRef(false);
  const lastProcessedLocation = useRef<{lat: number, lon: number, time: number} | null>(null);
  const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

  useEffect(() => {
    if (!lastKnownLocation || processingLocation.current) return;
    
    // Prevent processing if we're within the update interval (5 mins) of the last processed location
    if (lastProcessedLocation.current) {
      const isSameLocation = 
        Math.abs(lastProcessedLocation.current.lat - lastKnownLocation.latitude) < 0.0001 &&
        Math.abs(lastProcessedLocation.current.lon - lastKnownLocation.longitude) < 0.0001;
      
      const timeDiff = Date.now() - lastProcessedLocation.current.time;
      
      // Skip if it's the same location and we haven't reached the update interval yet
      // Only allow updates if it's a completely new location or enough time has passed
      if (isSameLocation && timeDiff < UPDATE_INTERVAL_MS) {
        return;
      }
    }

    processingLocation.current = true;
    
    fetchLocationName(lastKnownLocation.latitude, lastKnownLocation.longitude)
      .then(locationName => {
        const newLocation = {
          ...lastKnownLocation,
          locationName,
          timestamp: Date.now()
        };
        
        setLocationName(locationName);
        // Calculate next update time based on our 5-minute interval
        setNextUpdateTime(new Date(Date.now() + UPDATE_INTERVAL_MS).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
        
        // Add to history only if it's not a duplicate or if sufficient time has passed
        setLocationHistory(prev => {
          const isDuplicate = prev.some(loc => 
            Math.abs(loc.latitude - newLocation.latitude) < 0.0001 &&
            Math.abs(loc.longitude - newLocation.longitude) < 0.0001 &&
            // Only consider it a duplicate if it's within the update interval
            Math.abs(loc.timestamp - newLocation.timestamp) < UPDATE_INTERVAL_MS
          );
          
          if (!isDuplicate) {
            return [newLocation, ...prev];
          }
          return prev;
        });
        
        lastProcessedLocation.current = {
          lat: lastKnownLocation.latitude,
          lon: lastKnownLocation.longitude,
          time: Date.now()
        };
        
        processingLocation.current = false;
      })
      .catch((error) => {
        console.error("Error processing location:", error);
        processingLocation.current = false;
      });
  }, [lastKnownLocation]);

  // Show welcome notification only once on component mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (isLocationActive) {
        toast.success("Location tracking is active", { id: 'location-active', duration: 3000 });
      }
    }
  }, [isLocationActive]);

  const fetchLocationName = async (latitude: number, longitude: number): Promise<string> => {
    try {
      if (latitude === 0 && longitude === 0) {
        return "Unknown location";
      }
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      } else {
        return "Unknown location";
      }
    } catch (error) {
      console.error("Error fetching location name:", error);
      return "Unknown location";
    }
  };

  const clearLocationHistory = () => {
    setLocationHistory([]);
    toast.success("Location history cleared");
  };
  
  const handleGetCurrentLocation = () => {
    // Only get location if the last update was more than 30 seconds ago
    // This prevents excessive updates when the user clicks the Get button repeatedly
    if (lastProcessedLocation.current && Date.now() - lastProcessedLocation.current.time < 30000) {
      toast.success("Location was recently updated. Please wait before requesting again.", { duration: 2000 });
      return;
    }
    
    handleGetLastLocation();
  };
  
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen">
      <Toaster />
      <div className="space-y-4 mt-2">
        {/* Location Controls */}
        <div className="bg-[#2A2F33] rounded-lg p-4">
          <h3 className="text-white text-lg font-medium mb-2">Location Settings</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <MapPin size={20} className="text-gray-400 mr-3" />
                <span className="text-white">
                  {isLocationActive ? 'Stop Location Tracking' : 'Start Location Tracking'}
                </span>
              </div>
              <button
                onClick={isLocationActive ? handleStopLocationListener : handleStartLocationListener}
                className={`w-20 px-4 py-2 rounded text-white ${
                  isLocationActive 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isLocationActive ? 'Stop' : 'Start'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <MapPin size={20} className="text-gray-400 mr-3" />
                <span className="text-white">Get Current Location</span>
              </div>
              <button
                onClick={handleGetCurrentLocation}
                className="w-20 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Get
              </button>
            </div>

            {lastKnownLocation ? (
              <div className="mt-2 p-3 bg-[#34393E] rounded">
                <p className="text-white text-sm">
                  Lat: {lastKnownLocation.latitude.toFixed(4)}
                </p>
                <p className="text-white text-sm">
                  Lon: {lastKnownLocation.longitude.toFixed(4)}
                </p>
                <p className="text-white text-sm mt-2">
                  Location: {locationName || "Unknown location"}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Status: {isLocationActive ? 'Active' : 'Inactive'}
                </p>
                <p className="text-gray-400 text-xs">
                  Updated: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                </p>
                {nextUpdateTime && (
                  <p className="text-gray-400 text-xs">
                    Next update: {nextUpdateTime}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No location data available</p>
            )}
          </div>
        </div>

        {/* Location History */}
        <div className="bg-[#2A2F33] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white text-lg font-medium">Location History</h3>
            {locationHistory.length > 0 && (
              <button
                onClick={clearLocationHistory}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
              >
                Clear
              </button>
            )}
          </div>
          
          {locationHistory.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {locationHistory.map((location, index) => (
                <div key={index} className="mt-2 p-3 bg-[#34393E] rounded mb-2">
                  <div className="flex items-center text-white text-sm mb-1">
                    <Clock size={14} className="mr-1 text-gray-400" />
                    {formatTimestamp(location.timestamp)}
                  </div>
                  <p className="text-white text-sm">
                    Lat: {location.latitude.toFixed(4)}
                  </p>
                  <p className="text-white text-sm">
                    Lon: {location.longitude.toFixed(4)}
                  </p>
                  {location.locationName && (
                    <p className="text-white text-sm mt-1">
                      {location.locationName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No location history available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationView;