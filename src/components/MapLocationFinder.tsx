// MapLocationFinder.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, BatteryCharging } from 'lucide-react';

// You'll need to install: npm install @react-google-maps/api
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
  Autocomplete
} from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: -1.286389, // Default coordinates for Nairobi
  lng: 36.817223
};

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

// Predefined charging stations
const chargingStations = [
  {
    name: "Omega Business Park",
    placeId: "ChIJsdQXBH0ZLxgRMlGVLGvPUJ0",
    address: "Omega Business Park, Nairobi"
  },
  {
    name: "TotalEnergies Donholm Service Station",
    placeId: "ChIJhbCl5XwbLxgR9fwHm2iFTNw",
    address: "Outer Ring Rd, Nairobi"
  },
  {
    name: "TotalEnergies Ngong Road service station",
    placeId: "ChIJp9Xw0jAQLxgRpg9PYmUOmLM",
    address: "00505 Ngong Rd, Nairobi"
  },
  {
    name: "Shell petrol station, Kangundo Rd",
    placeId: "ChIJRYoSO3cbLxgRY8nDYeMj5Ww",
    address: "Kangundo Rd, Nairobi"
  },
  {
    name: "Shell Petrol Station, Denis Pritt Road",
    placeId: "ChIJRReLlnkTLxgRYTKQ3_l4Jno",
    address: "PQ7R+JRW, Denis Pritt Rd, Nairobi"
  }
];

// Create a set of place IDs for faster lookup
const chargingStationPlaceIds = new Set(chargingStations.map(station => station.placeId));

const MapLocationFinder: React.FC = () => {
  // State for managing the search bar
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // States for Google Maps
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    address: string;
    position: google.maps.LatLngLiteral;
    placeId: string;
    photo: string | null;
    status: string;
    distance: string;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [viewMode, setViewMode] = useState('map');
  const [chargingMarkers, setChargingMarkers] = useState<Array<{
    position: google.maps.LatLngLiteral;
    name: string;
    placeId: string;
  }>>([]);

  // Refs for Google services
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load the Google Maps API
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyCj4szs84b3W-K6QSDV79gd8CK3tmKdDZ0";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
  });

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Geolocation error:", error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  }, []);

  useEffect(() => {
    // Set up Places and Directions services when map is loaded
    if (map) {
      placesServiceRef.current = new google.maps.places.PlacesService(map);
      directionsServiceRef.current = new google.maps.DirectionsService();

      // Fetch charging station locations
      fetchChargingStationLocations();
    }
  }, [map]);

  // Fetch the coordinates of predefined charging stations
  const fetchChargingStationLocations = () => {
    if (!placesServiceRef.current) return;

    const markers: Array<{
      position: google.maps.LatLngLiteral;
      name: string;
      placeId: string;
    }> = [];

    // Use Place Details request to get detailed info about each station
    const fetchStationDetails = async (station: typeof chargingStations[0]) => {
      return new Promise<void>((resolve) => {
        placesServiceRef.current?.getDetails(
          {
            placeId: station.placeId,
            fields: ['geometry', 'name', 'place_id']
          },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
              markers.push({
                position: {
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng()
                },
                name: place.name || station.name,
                placeId: station.placeId
              });
            } else {
              console.error(`Error fetching details for station ${station.name}:`, status);
            }
            resolve();
          }
        );
      });
    };

    // Process each station and update markers when all are fetched
    const fetchAllStations = async () => {
      for (const station of chargingStations) {
        await fetchStationDetails(station);
      }
      setChargingMarkers(markers);
    };

    fetchAllStations();
  };

  const onMapLoad = (map: google.maps.Map) => {
    setMap(map);
  };

  // Check if the selected location is a charging station
  const isChargingStation = (placeId: string) => {
    return chargingStationPlaceIds.has(placeId);
  };

  // Handle Autocomplete Load
  const onAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  // Handle place selection from autocomplete
  const handlePlaceSelect = () => {
    if (!autocompleteRef.current) return;

    const place = autocompleteRef.current.getPlace();

    if (!place.geometry || !place.geometry.location) {
      console.error("Place selection did not return geometry");
      return;
    }

    // Center the map on the selected location
    if (place.geometry.location) {
      map?.setCenter(place.geometry.location);
      map?.setZoom(15); // Ensure we zoom in enough to see the location
    }

    // Get photo if available
    const photoUrl = place.photos && place.photos.length > 0
      ? place.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 })
      : null;

    // Check if this location is a charging station - using our Set for faster lookup
    const isCharging = isChargingStation(place.place_id || "");

    // Save the selected location
    setSelectedLocation({
      name: place.name || "Unknown Location",
      address: place.formatted_address || "No address available",
      position: {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      },
      placeId: place.place_id || "",
      photo: photoUrl,
      status: isCharging ? "Available for charging" : "Not available for charging",
      distance: "Calculating..."
    });

    // Calculate route if user location is available
    if (userLocation) {
      calculateRoute(place.geometry.location);
    }
  };

  // Handle charging station marker click
  const handleMarkerClick = (marker: typeof chargingMarkers[0]) => {
    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId: marker.placeId,
        fields: ['name', 'geometry', 'formatted_address', 'photos', 'place_id']
      },
      (place: any, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          // Center the map on the selected location
          if (place.geometry && place.geometry.location) {
            map?.setCenter(place.geometry.location);
            map?.setZoom(15); // Ensure we zoom in enough to see the location

            // Get photo if available
            const photoUrl = place.photos && place.photos.length > 0
              ? place.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 })
              : null;

            // Extract lat/lng safely
            const position = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            };

            // Since this marker is from our charging station list, it's always available
            setSelectedLocation({
              name: place.name || marker.name,
              address: place.formatted_address || "No address available",
              position,
              placeId: marker.placeId,
              photo: photoUrl,
              status: "Available for charging", // Always mark as available since it's from our list
              distance: "Calculating..."
            });

            // Calculate route if user location is available
            if (userLocation) {
              calculateRoute(place.geometry.location);
            }
          } else {
            console.error("No geometry location found for this place");
            // Fallback to marker position if available
            if (marker.position) {
              map?.setCenter(marker.position);
              map?.setZoom(15);

              setSelectedLocation({
                name: marker.name,
                address: "No address available",
                position: marker.position,
                placeId: marker.placeId,
                photo: null,
                status: "Available for charging", // Always mark as available
                distance: "Calculating..."
              });

              // Calculate route if user location is available
              if (userLocation) {
                calculateRoute(marker.position);
              }
            }
          }
        }
      }
    );
  };

  // Calculate route between user location and destination
  const calculateRoute = (destination: google.maps.LatLng | google.maps.LatLngLiteral) => {
    if (!directionsServiceRef.current) {
      console.error("Directions service not available");
      return;
    }

    if (!userLocation) {
      console.error("User location not available");
      return;
    }

    directionsServiceRef.current.route(
      {
        origin: userLocation,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);

          // Update the distance in the selected location
          if (result.routes[0] && result.routes[0].legs[0]) {
            setSelectedLocation(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                distance: result.routes[0].legs[0].distance?.text || "Unknown"
              };
            });
          }
        } else {
          // Handle routing errors
          console.error("Directions request failed with status:", status);
        }
      }
    );
  };

  const handleGetDirections = () => {
    if (selectedLocation && userLocation) {
      calculateRoute(selectedLocation.position);
    } else {
      console.error("Cannot get directions: Missing location data");
    }
  };

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In case the user hits enter without selecting from autocomplete
    if (searchInputRef.current?.value && !selectedLocation) {
      // Use the Places service to search for the query
      if (placesServiceRef.current) {
        const request = {
          query: searchInputRef.current.value,
          fields: ["name", "geometry", "formatted_address", "place_id", "photos"]
        };

        placesServiceRef.current.findPlaceFromQuery(request, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            const place = results[0];
            if (place.geometry && place.geometry.location) {
              // Center the map on the found location
              map?.setCenter(place.geometry.location);
              map?.setZoom(15);

              const photoUrl = place.photos && place.photos.length > 0
                ? place.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 })
                : null;

              // Check if this location is a charging station using our Set
              const isCharging = isChargingStation(place.place_id || "");

              // Save the selected location
              setSelectedLocation({
                name: place.name || "Unknown Location",
                address: place.formatted_address || "No address available",
                position: {
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                },
                placeId: place.place_id || "",
                photo: photoUrl,
                status: isCharging ? "Available for charging" : "Not available for charging",
                distance: "Calculating..."
              });

              // Calculate route if user location is available
              if (userLocation) {
                calculateRoute(place.geometry.location);
              }
            }
          } else {
            console.error("Place search failed with status:", status);
          }
        });
      }
    }
  };

  // Handle list item click - Direct method to get details for a station
  const handleListItemClick = (station: typeof chargingStations[0]) => {
    // First switch to map view
    setViewMode('map');

    if (!map || !placesServiceRef.current) {
      console.error("Map or Places service not initialized");
      return;
    }

    // Use a more direct approach for handling list item clicks
    // First, look for the marker in our chargingMarkers state
    const marker = chargingMarkers.find(m => m.placeId === station.placeId);

    if (marker && marker.position) {
      // If we have the marker with position, use it directly
      map.setCenter(marker.position);
      map.setZoom(15);

      // Set selected location with what we know
      setSelectedLocation({
        name: station.name,
        address: station.address,
        position: marker.position,
        placeId: station.placeId,
        photo: null, // We'll try to fetch this below
        status: "Available for charging",
        distance: "Calculating..."
      });

      // Calculate route
      if (userLocation) {
        calculateRoute(marker.position);
      }

      // Try to get more details like photos
      placesServiceRef.current.getDetails(
        {
          placeId: station.placeId,
          fields: ['photos', 'formatted_address']
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            // Get photo if available
            const photoUrl = place.photos && place.photos.length > 0
              ? place.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 })
              : null;

            // Update with photo and better address if available
            setSelectedLocation(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                photo: photoUrl,
                address: place.formatted_address || prev.address
              };
            });
          }
        }
      );
    } else {
      // If marker not found, fetch it directly using Place Details
      placesServiceRef.current.getDetails(
        {
          placeId: station.placeId,
          fields: ['name', 'geometry', 'formatted_address', 'photos']
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
            // Center the map
            map.setCenter(place.geometry.location);
            map.setZoom(15);

            // Get photo if available
            const photoUrl = place.photos && place.photos.length > 0
              ? place.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 })
              : null;

            // Create position object
            const position = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            };

            // Set selected location
            setSelectedLocation({
              name: place.name || station.name,
              address: place.formatted_address || station.address,
              position,
              placeId: station.placeId,
              photo: photoUrl,
              status: "Available for charging",
              distance: "Calculating..."
            });

            // Calculate route
            if (userLocation) {
              calculateRoute(position);
            }
          } else {
            console.error("Place details request failed:", status);
            // If place details fails, try nearbySearch as last resort
            placesServiceRef.current?.nearbySearch(
              {
                location: center, // Use default center for search
                radius: 50000, // Large radius to find it
                name: station.name
              },
              (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                  const firstResult = results[0];
                  if (firstResult.geometry && firstResult.geometry.location) {
                    // Center map
                    map.setCenter(firstResult.geometry.location);
                    map.setZoom(15);

                    // Set selected location
                    setSelectedLocation({
                      name: station.name,
                      address: station.address,
                      position: {
                        lat: firstResult.geometry.location.lat(),
                        lng: firstResult.geometry.location.lng()
                      },
                      placeId: station.placeId,
                      photo: null,
                      status: "Available for charging",
                      distance: "Calculating..."
                    });
                  }
                }
              }
            );
          }
        }
      );
    }
  };

  // Improved error UI
  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Maps</h2>
          <p className="text-gray-700">There was a problem loading Google Maps. Please check your internet connection and API key.</p>
        </div>
      </div>
    );
  }

  // Improved loading UI
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-900 mx-auto"></div>
          <p className="mt-4 text-indigo-900 font-semibold">Loading maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white relative">
      {/* Search Bar with Autocomplete */}
      <div className="relative mb-4">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Autocomplete
            onLoad={onAutocompleteLoad}
            onPlaceChanged={handlePlaceSelect}
            options={{
              componentRestrictions: { country: "ke" },
              fields: ["address_components", "geometry", "name", "formatted_address", "place_id", "photos"],
              strictBounds: false,
              types: ["establishment", "geocode"]
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for charging stations..."
              className="w-full px-4 py-2 border border-gray-300 bg-white rounded-lg pr-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Autocomplete>
          <button
            type="submit"
            className="absolute right-3 top-2.5 flex items-center space-x-3 bg-transparent border-none cursor-pointer"
          >
            <Search className="w-5 h-5 text-gray-500 hover:text-blue-600" />
          </button>
        </form>
      </div>

      {/* Map View */}
      <div className="flex-1 mt-16 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={userLocation || center}
          zoom={14}
          onLoad={onMapLoad}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#4285F4",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }}
            />
          )}

          {/* Display charging station markers */}
          {chargingMarkers.map((marker, index) => (
            <Marker
              key={`charging-${index}`}
              position={marker.position}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
              }}
              title={marker.name}
              onClick={() => handleMarkerClick(marker)}
            />
          ))}

          {/* Display selected location marker */}
          {selectedLocation && (
            <Marker
              position={selectedLocation.position}
              icon={{
                url: selectedLocation.status === "Available for charging"
                  ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                  : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
              }}
            />
          )}

          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>
      </div>

      {/* View Toggle */}
      <div className="absolute bottom-64 left-4 z-10">
        <div className="bg-indigo-900 text-white rounded-full flex items-center p-1">
          <button
            className={`px-3 py-1 rounded-full ${viewMode === 'map' ? 'bg-indigo-700' : ''}`}
            onClick={() => setViewMode('map')}
          >
            Map View
          </button>
          <button
            className={`px-3 py-1 rounded-full ${viewMode === 'list' ? 'bg-indigo-700' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      {/* Location Info Card */}
      {selectedLocation && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-lg shadow-lg p-4">
          <div className="flex mb-3">
            <div className="w-24 h-24 bg-gray-300 rounded-md overflow-hidden">
              {selectedLocation.photo ? (
                <img src={selectedLocation.photo} alt={selectedLocation.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <MapPin size={32} className="text-gray-400" />
                </div>
              )}
            </div>
            <div className="ml-3 flex-1">
              <h3 className="font-bold text-lg">{selectedLocation.name}</h3>
              <p className="text-gray-600 text-sm">{selectedLocation.address}</p>
              <div className="flex items-center mt-1">
                <span className={`inline-block w-2 h-2 rounded-full ${selectedLocation.status === "Available for charging" ? "bg-green-500" : "bg-red-500"} mr-1`}></span>
                <span className="text-gray-500 text-xs">{selectedLocation.status}</span>
              </div>
              <div className="text-gray-500 text-xs mt-1">
                Distance: {selectedLocation.distance}
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              className={`${selectedLocation.status === "Available for charging" ? "bg-indigo-900" : "bg-gray-400"} text-white py-2 px-4 rounded-md flex-1 mr-2`}
              onClick={() => alert(selectedLocation.status === "Available for charging" ? "Checking status... Feature coming soon." : "This location is not available for charging.")}
              disabled={selectedLocation.status !== "Available for charging"}
            >
              Check Status
            </button>
            <button
              className="bg-indigo-900 text-white py-2 px-4 rounded-md flex-1"
              onClick={handleGetDirections}
            >
              Get Directions
            </button>
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="absolute bottom-0 left-0 right-0 top-16 bg-white z-10 overflow-y-auto p-4">
          <h2 className="text-xl font-bold mb-4">Charging Stations</h2>
          {chargingStations.map((station, index) => (
            <div
              key={`list-${index}`}
              className="border-b border-gray-200 py-3 flex items-center cursor-pointer"
              onClick={() => handleListItemClick(station)}
            >
              <div className="bg-indigo-100 rounded-full p-2 mr-3">
                <BatteryCharging size={24} className="text-indigo-900" />
              </div>
              <div>
                <h3 className="font-medium">{station.name}</h3>
                <p className="text-gray-600 text-sm">{station.address}</p>
                <div className="flex items-center mt-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                  <span className="text-gray-500 text-xs">Available for charging</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapLocationFinder;