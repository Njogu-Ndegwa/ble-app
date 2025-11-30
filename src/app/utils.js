// ============================================================
// DTA Service UUIDs - Standardized across all battery devices
// ============================================================
export const DTA_SERVICE_UUID = "9b074000-d1ec-4451-be62-f86a05dd9b47";

// Energy-related characteristic UUIDs (only what's needed for billing)
export const DTA_CHARACTERISTIC_UUIDS = {
  // Required for energy calculation
  RCAP: "9b074008-d1ec-4451-be62-f86a05dd9b47", // Remaining Capacity in Wh
  PCKV: "9b074005-d1ec-4451-be62-f86a05dd9b47", // Pack Voltage in mV
  // Optional for charge percentage
  FCCP: "9b074009-d1ec-4451-be62-f86a05dd9b47", // Full Charge Capacity in Wh
  RSOC: "9b074007-d1ec-4451-be62-f86a05dd9b47", // Relative State of Charge (%)
  // Other commonly used characteristics (for reference)
  PCKC: "9b074006-d1ec-4451-be62-f86a05dd9b47", // Pack Current in mA
  PCKT: "9b07400a-d1ec-4451-be62-f86a05dd9b47", // Pack Temperature in Celsius
  AENG: "9b074004-d1ec-4451-be62-f86a05dd9b47", // Accumulated Energy Output in Wh
  ACYC: "9b074011-d1ec-4451-be62-f86a05dd9b47", // Accumulated Cycles
};

// Energy calculation characteristics - minimal set for attendant workflow
export const ENERGY_CALC_CHARACTERISTICS = [
  { name: 'rcap', uuid: DTA_CHARACTERISTIC_UUIDS.RCAP, desc: 'Remaining Capacity (Wh)' },
  { name: 'pckv', uuid: DTA_CHARACTERISTIC_UUIDS.PCKV, desc: 'Pack Voltage (mV)' },
  { name: 'fccp', uuid: DTA_CHARACTERISTIC_UUIDS.FCCP, desc: 'Full Charge Capacity (Wh)' },
  { name: 'rsoc', uuid: DTA_CHARACTERISTIC_UUIDS.RSOC, desc: 'State of Charge (%)' },
];

export const connBleByMacAddress = (macAddress, callback) => {
    window.WebViewJavascriptBridge.callHandler('connBleByMacAddress', macAddress, (responseData) => {
        console.info(responseData);
        if (callback) callback(responseData);
    });
};

export const initBleData = (macAddress, callback) => {
    window.WebViewJavascriptBridge.callHandler('initBleData', macAddress, (responseData) => {
        console.info("initBleData:" + responseData);
        if (callback) callback(responseData);
    });
};

export const initServiceBleData = (data, callback) => {
  window.WebViewJavascriptBridge.callHandler(
      'initServiceBleData', 
      data,
      (responseData) => {
          console.info("initServiceBleData:" + responseData);
          if (callback) callback(responseData);
      }
  );
};

/**
 * Read only energy-related characteristics from a battery device.
 * This is optimized for the attendant workflow where we only need:
 * - rcap (Remaining Capacity) + pckv (Pack Voltage) for energy calculation
 * - fccp (Full Charge Capacity) / rsoc (State of Charge) for charge percentage
 * 
 * @param {string} macAddress - The MAC address of the connected BLE device
 * @param {function} callback - Called with { rcap, pckv, fccp, rsoc, energy, chargePercent } or null on error
 * @param {function} progressCallback - Optional callback for progress updates (0-100)
 */
export const readEnergyCharacteristics = (macAddress, callback, progressCallback) => {
  if (!window.WebViewJavascriptBridge) {
    console.error("WebViewJavascriptBridge is not available");
    if (callback) callback(null, "WebView bridge not initialized");
    return;
  }

  const characteristics = ENERGY_CALC_CHARACTERISTICS;
  const results = {};
  let completedReads = 0;
  let hasError = false;

  console.info(`[readEnergyCharacteristics] Reading ${characteristics.length} characteristics for energy calculation...`);

  // Read each characteristic sequentially to avoid overwhelming the BLE stack
  const readNext = (index) => {
    if (index >= characteristics.length) {
      // All reads complete - calculate energy
      const { rcap, pckv, fccp, rsoc } = results;
      
      if (rcap === undefined || pckv === undefined) {
        console.warn("[readEnergyCharacteristics] Missing required values:", { rcap, pckv });
        if (callback) callback(null, "Missing required energy values (rcap/pckv)");
        return;
      }

      // Energy (Wh) = Capacity (mAh) × Voltage (mV) / 1,000,000
      const energy = (rcap * pckv) / 1_000_000;
      const fullCapacity = fccp !== undefined ? (fccp * pckv) / 1_000_000 : 0;
      
      // Calculate charge percentage
      let chargePercent;
      if (fccp !== undefined && fccp > 0) {
        chargePercent = Math.round((rcap / fccp) * 100);
      } else if (rsoc !== undefined) {
        chargePercent = Math.round(rsoc);
      } else {
        chargePercent = 0;
      }
      chargePercent = Math.max(0, Math.min(100, chargePercent));

      console.info("[readEnergyCharacteristics] Energy calculated:", {
        rcap, pckv, fccp, rsoc,
        energy_Wh: energy,
        energy_kWh: energy / 1000,
        chargePercent
      });

      if (callback) {
        callback({
          rcap,
          pckv,
          fccp,
          rsoc,
          energy: Math.round(energy * 100) / 100,
          fullCapacity: Math.round(fullCapacity * 100) / 100,
          chargePercent
        });
      }
      return;
    }

    const char = characteristics[index];
    
    if (progressCallback) {
      progressCallback(Math.round((index / characteristics.length) * 100));
    }

    console.info(`[readEnergyCharacteristics] Reading ${char.name} (${index + 1}/${characteristics.length})...`);

    readBleCharacteristic(
      DTA_SERVICE_UUID,
      char.uuid,
      macAddress,
      (data, error) => {
        if (error) {
          console.warn(`[readEnergyCharacteristics] Error reading ${char.name}:`, error);
          // Continue reading other characteristics even if one fails
          // rcap and pckv are required, others are optional
          if (char.name === 'rcap' || char.name === 'pckv') {
            hasError = true;
          }
        } else if (data !== null && data !== undefined) {
          // Parse the value - handle different formats
          let value;
          if (typeof data === 'object' && data.realVal !== undefined) {
            value = parseFloat(data.realVal);
          } else if (typeof data === 'number') {
            value = data;
          } else {
            value = parseFloat(data);
          }
          
          if (Number.isFinite(value)) {
            results[char.name] = value;
            console.info(`[readEnergyCharacteristics] ${char.name} = ${value}`);
          }
        }
        
        completedReads++;
        
        // Read next characteristic after a small delay to prevent BLE congestion
        setTimeout(() => readNext(index + 1), 50);
      }
    );
  };

  // Start reading
  readNext(0);
};

export const readBleCharacteristic = (serviceUUID, characteristicUUID, macAddress, callback) => {
    // if (!macAddress) {
    //   console.error("No MAC address provided. Retrieving from sessionStorage...");
    //   macAddress = sessionStorage.getItem('connectedDeviceMac');
    //   if (!macAddress) {
    //     console.error("Failed to get MAC address. Cannot read characteristic.");
    //     return;
    //   }
    // }
  
    const data = {
      serviceUUID: serviceUUID,
      characteristicUUID: characteristicUUID,
      macAddress: macAddress
    };
  
    // Call the WebView Javascript Bridge or Web Bluetooth API to read the characteristic
    window.WebViewJavascriptBridge.callHandler(
      'readBleCharacteristic',  // You can replace this with the specific handler for reading characteristics
      data,
      (responseData) => {
        try {
          // Parse the response
          const response = JSON.parse(responseData);
          console.info(response, "Response Data readBleCharacteristic")
          if (response.respData) {
            // Call the callback with the retrieved data
            callback(response.respData);
            console.info(response.respData, "Response Data readBleCharacteristic")
          } else {
            // Handle failure in reading the characteristic
            console.error("Read failed:", response.respDesc);
            callback(null, response.respDesc);
          }
        } catch (e) {
          // Handle error parsing the response
          console.error("Error parsing read response:", e);
          callback(null, "Error parsing response");
        }
      }
    );
  };


  // Common Bridge Functions
export const writeBleCharacteristic = (serviceUUID, characteristicUUID, value, macAddress, callback) => {
    // Verify WebView bridge is available
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge is not available");
      if (callback) {
        callback(null, "WebView bridge not initialized");
      }
      return;
    }
  
    const data = {
      serviceUUID: serviceUUID,
      characteristicUUID: characteristicUUID,
      value: value,
      macAddress: macAddress,
    };
  
    console.info("Initiating BLE write operation:", {
      serviceUUID,
      characteristicUUID,
      macAddress,
      valueLength: typeof value === 'string' ? value.length : 'number',
      valueType: typeof value
    });
  
    window.WebViewJavascriptBridge.callHandler(
      'writeBleCharacteristic', data,
      (responseData) => {
        console.warn("Write response received:", responseData);
        console.info("Write response type:", typeof responseData);
        
        // Enhanced logging for debugging
        if (typeof responseData === 'string') {
          try {
            const parsed = JSON.parse(responseData);
            console.info("Parsed write response:", parsed);
          } catch (e) {
            console.info("Write response is plain string:", responseData);
          }
        } else {
          console.info("Write response is object:", responseData);
        }
        
        if (callback) {
          callback(responseData);
        }
      }
    );
  };
 
// export const connBleByMacAddress = (macAddress, callback) => {
//     window.WebViewJavascriptBridge.callHandler('connBleByMacAddress', macAddress, (responseData) => {
//         console.info(responseData);
//         if (callback) callback(responseData);
//     });
// };

// export const initBleData = (macAddress, callback) => {
//     window.WebViewJavascriptBridge.callHandler('initBleData', macAddress, (responseData) => {
//         console.info("initBleData:" + responseData);
//         if (callback) callback(responseData);
//     });
// };

// export const initServiceBleData = (data, callback) => {
//   window.WebViewJavascriptBridge.callHandler(
//       'initServiceBleData', 
//       data,
//       (responseData) => {
//           console.info("initServiceBleData:" + responseData);
//           if (callback) callback(responseData);
//       }
//   );
// };

// export const readBleCharacteristic = (serviceUUID, characteristicUUID, macAddress, callback) => {
//     // if (!macAddress) {
//     //   console.error("No MAC address provided. Retrieving from sessionStorage...");
//     //   macAddress = sessionStorage.getItem('connectedDeviceMac');
//     //   if (!macAddress) {
//     //     console.error("Failed to get MAC address. Cannot read characteristic.");
//     //     return;
//     //   }
//     // }
  
//     const data = {
//       serviceUUID: serviceUUID,
//       characteristicUUID: characteristicUUID,
//       macAddress: macAddress
//     };
  
//     // Call the WebView Javascript Bridge or Web Bluetooth API to read the characteristic
//     window.WebViewJavascriptBridge.callHandler(
//       'readBleCharacteristic',  // You can replace this with the specific handler for reading characteristics
//       data,
//       (responseData) => {
//         try {
//           // Parse the response
//           const response = JSON.parse(responseData);
//           console.info(response, "Response Data readBleCharacteristic")
//           if (response.respData) {
//             // Call the callback with the retrieved data
//             callback(response.respData);
//             console.info(response.respData, "Response Data readBleCharacteristic")
//           } else {
//             // Handle failure in reading the characteristic
//             console.error("Read failed:", response.respDesc);
//             callback(null, response.respDesc);
//           }
//         } catch (e) {
//           // Handle error parsing the response
//           console.error("Error parsing read response:", e);
//           callback(null, "Error parsing response");
//         }
//       }
//     );
//   };


//   // Common Bridge Functions
// export const writeBleCharacteristic = (serviceUUID, characteristicUUID, value, macAddress, callback) => {
//     // if (!macAddress) {
//     //   console.error("No MAC address provided. Attempting to retrieve from sessionStorage.");
//     //   macAddress = sessionStorage.getItem('connectedDeviceMac');
      
//     //   if (!macAddress) {
//     //     console.error("Failed to get MAC address from sessionStorage. Cannot write to characteristic.");
//     //     return;
//     //   }
//     // }
  
//     const data = {
//       serviceUUID: serviceUUID,
//       characteristicUUID: characteristicUUID,
//       value: value,
//       macAddress: macAddress,
//     };
  
  
  
//     window.WebViewJavascriptBridge.callHandler(
//       'writeBleCharacteristic', data,
//       (responseData) => {
//         console.warn(responseData, "ResponseData")
//         console.info("Write response:", responseData);
//         if (callback) {
//           callback(responseData);
//         }
//       }
//     );
//   };