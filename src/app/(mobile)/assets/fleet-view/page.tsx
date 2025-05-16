
'use client'

import React, { useState, useRef } from 'react';
import MobileListView from './MobileListView';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import ProgressiveLoading from '../../../../components/loader/progressiveLoading';
import { connBleByMacAddress, initServiceBleData } from "../../../utils"
import { Toaster, toast } from 'react-hot-toast';
import { useBridge } from '@/app/context/bridgeContext';
let bridgeHasBeenInitialized = false;
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

interface AppState {
    bleData: any; // Could be refined based on actual data structure
    detectedDevices: BleDevice[];
    initBleData: any;
    mqttMessage: any;
    bridgeInitialized: boolean;
    isScanning: boolean;
}

type AppAction =
    | { type: "SET_BLE_DATA"; payload: any }
    | { type: "ADD_DETECTED_DEVICE"; payload: BleDevice }
    | { type: "SET_INIT_BLE_DATA"; payload: any }
    | { type: "SET_MQTT_MESSAGE"; payload: any }
    | { type: "SET_BRIDGE_INITIALIZED"; payload: boolean }
    | { type: "SET_IS_SCANNING"; payload: boolean };

interface MqttConfig {
    username: string;
    password: string;
    clientId: string;
    hostname: string;
    port: number;
}

interface WebViewJavascriptBridge {
    init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
    registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
    callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}


// Declare global window.WebViewJavascriptBridge
declare global {
    interface Window {
        WebViewJavascriptBridge?: WebViewJavascriptBridge;
    }
}
const defaultImageUrl = "https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png"


const AppContainer = () => {
    const { bridge } = useBridge()


    useEffect(() => {
        import('vconsole').then((module) => {
            const VConsole = module.default;
            new VConsole();
        });
    }, []);

    const setupBridge = (bridge: WebViewJavascriptBridge) => {
        console.error("Errorrrtrotorieutioerut")
        const noop = () => {}; 
        const reg = (name: string, handler: any) => {
          bridge.registerHandler(name, handler);
          return () => bridge.registerHandler(name, noop);
        };

        if (!bridgeHasBeenInitialized) {
            bridgeHasBeenInitialized = true;
            try {
                bridge.init((_m, r) => r('js success!'));
              } catch (error) {
                console.error("Error initializing bridge:", error);
              }
          }
    
        // Example of setting up handlers, adjust as needed
        const offPrint = reg('print', (data: string, resp: any) => {
          try {
            const parsed = JSON.parse(data);
            if (parsed?.data) resp(parsed.data);
            else throw new Error('Parsed data is not in the expected format.');
          } catch (err) {
            console.error("Error parsing JSON in 'print':", err);
          }
        });

            const offFindBle = reg(
              'findBleDeviceCallBack',
              (data: string, resp: (r: { success: boolean; error?: string }) => void) => {
                console.error(data, "97----fs")
              }
            );
    
        // Cleanup listeners when the component unmounts or the bridge changes
        return () => {
          offPrint(); // Cleanup this handler
          offFindBle();
          // Add cleanup for other handlers as needed
        };
      };

    useEffect(() => {
        console.log(bridge, "-----71------")
        if (bridge) {
            console.log(bridge, "-----71------")
            setupBridge(bridge);
            //   readDeviceInfo();
        }
    }, [bridge]);
    return (
        <div>Hello World</div>
    )
};

export default AppContainer;

