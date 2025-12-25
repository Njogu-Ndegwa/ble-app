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