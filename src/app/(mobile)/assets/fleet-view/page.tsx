
'use client'

import React, { useState, useRef } from 'react';
import MobileListView from './MobileListView';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import ProgressiveLoading from '../../../../components/loader/progressiveLoading';
import { connBleByMacAddress, initServiceBleData } from "../../../utils"
import { Toaster, toast } from 'react-hot-toast';
import { useBridge } from '@/app/context/bridgeContext';

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
    const {bridge} = useBridge()
    
  return (
    <div>Hello World</div>
  )
};

export default AppContainer;
