
'use client'

import React, { useState, useEffect } from 'react';
import MobileListView from './MobileListView';
import CmdServiceView from './CmdServiceView';
import ProgressiveLoading from './loader';
import { bleLoadingSteps } from './constants/loadingStepsConfig';
import { useBridge } from '@/app/context/BridgeContext';



const AppContainer = () => {
  const {
    selectedDevice,
    handleBackToList,
    startConnection,
    connectedDevice,
    startQrCodeScan,
    handleBLERescan,
    isScanning,
    detectedDevices,
    isConnecting,
    progress,
    loadingService,
    handleServiceDataRequest,
    attrList
  } = useBridge();
    const [isReloading, setIsReloading] = useState(false);
   useEffect(() => {
      // Check if we've already reloaded
      const hasReloaded = sessionStorage.getItem('hasReloaded');
      
      if (!hasReloaded) {
        // Set reloading state to true to show the loading indicator
        setIsReloading(true);
        
        // Store that we're going to reload
        sessionStorage.setItem('hasReloaded', 'true');
        
        // Set a timeout for the reload
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
      
      return () => {
        sessionStorage.removeItem('hasReloaded');
      };
    }, []);

  // Find the selected device data
  const deviceDetails = selectedDevice
    ? detectedDevices.find(device => device.macAddress === selectedDevice)
    : undefined;
 
    const LoadingOverlay = () => (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-800 font-medium">Initializing application...</p>
          <p className="text-gray-600 text-sm mt-2">Please wait, page will reload shortly</p>
        </div>
      </div>
    );
  return (
    <>
      {!selectedDevice ? (
        <MobileListView
          items={detectedDevices}
          onStartConnection={startConnection}
          connectedDevice={connectedDevice}
          onScanQrCode={startQrCodeScan}
          onRescanBleItems={handleBLERescan}
          isScanning={isScanning}
        />
      ) : (
        <CmdServiceView
        //@ts-ignore
          device={deviceDetails}
          attributeList={attrList}
          onBack={handleBackToList}
          onRequestServiceData={handleServiceDataRequest}
          isLoadingService={loadingService}
        />
      )}
         {isReloading && <LoadingOverlay />}
    
      {isConnecting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="w-full max-w-md">
            <ProgressiveLoading
              initialMessage="Preparing to connect..."
              completionMessage="Connection established!"
              loadingSteps={bleLoadingSteps}
              onLoadingComplete={() => { }} // Handled in callback
              autoProgress={false} // Use real progress
              progress={progress} // Pass real progress
            />
          </div>
        </div>
      )}
    </>
  );
}

export default AppContainer;

