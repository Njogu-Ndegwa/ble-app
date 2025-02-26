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
    // if (!macAddress) {
    //   console.error("No MAC address provided. Attempting to retrieve from sessionStorage.");
    //   macAddress = sessionStorage.getItem('connectedDeviceMac');
      
    //   if (!macAddress) {
    //     console.error("Failed to get MAC address from sessionStorage. Cannot write to characteristic.");
    //     return;
    //   }
    // }
  
    const data = {
      serviceUUID: serviceUUID,
      characteristicUUID: characteristicUUID,
      value: value,
      macAddress: macAddress,
    };
  
  
  
    window.WebViewJavascriptBridge.callHandler(
      'writeBleCharacteristic', data,
      (responseData) => {
        console.info("Write response:", responseData);
        if (callback) {
          callback(responseData);
        }
      }
    );
  };