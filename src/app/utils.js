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
