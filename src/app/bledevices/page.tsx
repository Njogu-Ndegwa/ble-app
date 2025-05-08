'use client'
import React, { useState, useEffect } from 'react';
import { useBridge } from '@/app/context/BridgeContext';
import MobileListView from '@/app/MobileListView';
import ProgressiveLoading from '@/app/loader';
import ProtectedRoute from '@/app/components/protectedRoute';
import { bleLoadingSteps } from '@/app/constants/loadingStepsConfig';
import DeviceDetailView from '../DeviceDetailView';

const BleDevicePage = () => {
    const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
    const [isReloading, setIsReloading] = useState(false);

    const {
        bridgeInitialized,
        isScanning,
        detectedDevices,
        connectedDevice,
        isConnecting,
        connectingDeviceId,
        progress,
        attrList,
        startConnection,
        startQrCodeScan,
        handleBLERescan,
        handleServiceDataRequest,
        loadingService,
        handlePublish,
    } = useBridge();
    
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

    const handleDeviceSelect = (deviceId: string) => {
        setSelectedDevice(deviceId);
    };

    const handleBackToList = () => {
        setSelectedDevice(null);
    };

    // Handle completion of connection
    useEffect(() => {
        if (progress === 100 && connectingDeviceId) {
            setSelectedDevice(connectingDeviceId);
        }
    }, [progress, connectingDeviceId]);
    
    // Loading overlay component
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
            <ProtectedRoute>
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
                    <DeviceDetailView
                        device={deviceDetails!}
                        attributeList={attrList}
                        onBack={handleBackToList}
                        onRequestServiceData={handleServiceDataRequest}
                        isLoadingService={loadingService}
                        handlePublish={handlePublish} // Pass handlePublish to DeviceDetailView

                    />
                )}
            </ProtectedRoute>
            
            {isReloading && <LoadingOverlay />}
    
            {isConnecting && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="w-full max-w-md">
                        <ProgressiveLoading
                            initialMessage="Preparing to connect..."
                            completionMessage="Connection established!"
                            loadingSteps={bleLoadingSteps}
                            onLoadingComplete={() => { }}
                            autoProgress={false}
                            progress={progress}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default BleDevicePage;