# Mosiac WebView Application (OvApp)

## Overview

This Mosiac WebView application is integrated into an Android application and provides three core functionalities:

1. **BLE Scanner**: Scans for nearby Bluetooth Low Energy (BLE) devices, connects to a selected device, retrieves data from it, and publishes this data to an MQTT broker.
2. **Scan and Bind**: Scans a device's barcode and matches it with the list of BLE devices discovered during the scanning process.
3. **WebView Frontend**: Provides a responsive, modern user interface for these functionalities, built using React, Tailwind CSS, and Mosaic.

The application is designed to bridge the gap between native Android capabilities and web-based UI for a seamless user experience. Additionally, the app works offline, leveraging a service broker that ensures core functionalities remain operational even without an active internet connection.

---

## Features

### 1. BLE Scanner

- Scans for nearby BLE devices and lists them in real-time.
- Establishes a secure connection with the selected BLE device.
- Fetches data from the connected device, such as readings or status information.
- Publishes the retrieved data to an MQTT broker for further analysis or integration with other systems.

### 2. Scan and Bind

- Utilizes a barcode scanner to read barcodes of devices.
- Matches the scanned barcode with the list of BLE devices discovered during the scan.
- Enables binding of a device for easier tracking and future interactions.
- Displays real-time feedback to confirm successful binding.

### 3. WebView Integration

- The Android application integrates a WebView to display a React-based frontend.
- Provides a seamless and dynamic user interface using React components.
- Tailwind CSS ensures quick and consistent styling.
- Mosaic UI components are used for pre-designed layouts and user interface elements, enhancing development speed and consistency.

### 4. Offline Functionality

- The application remains functional offline using a service broker.
- Enables BLE scanning, barcode matching, and data binding without requiring an active internet connection.
- Stores necessary data locally to support offline operations, ensuring a reliable user experience in low-connectivity environments.

---

## Architecture

### Frontend

- **React**: A modern JavaScript library for building user interfaces.
- **Tailwind CSS**: A utility-first CSS framework for rapid UI development.
- **Mosaic**: A UI toolkit for creating responsive and accessible components.

### Backend

- **MQTT**: Used for lightweight, efficient data transfer between the application and the server.

### Native Android

- **WebView**: Embeds the React web application into the Android app for a native-like experience.
- **BLE Integration**: Leverages Android's BLE APIs to scan and connect to nearby devices.
- **Service Broker**: Ensures offline functionality by managing data synchronization and local storage.

---

## Installation and Setup

### Prerequisites

Ensure you have the following installed on your system:

- **Android Studio**: For building and running the Android application.
- **Node.js** (v16+): For building the React application.
- **MQTT Broker**: A configured MQTT broker for testing data publishing.

### Steps to Set Up

#### 1. Clone the Repository

```bash
git clone <https://github.com/ovesorg/Device-Scanner-Webview.git>
cd <repository_folder>
```

#### 2. Set Up the Web Application

1. Navigate to the `web` directory:
   ```bash
   cd web
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Build the React application for production:
   ```bash
   npm run build
   ```
4. Copy the production build files to the Android project's `assets` directory:
   ```bash
   cp -r build/* ../android/app/src/main/assets/
   ```

#### 3. Set Up the Android Application

1. Open the `android` directory in Android Studio.
2. Configure the WebView to point to the `index.html` file in the `assets` directory.
3. Update the `AndroidManifest.xml` file with permissions for BLE and internet access:
   ```xml
   <uses-permission android:name="android.permission.BLUETOOTH"/>
   <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
   <uses-permission android:name="android.permission.INTERNET"/>
   ```
4. Build and run the application on a connected Android device or emulator.

---

## Usage

### BLE Scanner

1. Launch the application and navigate to the BLE Scanner module.
2. Click "Scan" to discover nearby BLE devices.
3. Select a device from the list to connect.
4. View the fetched data and publish it to the MQTT broker by clicking "Publish."

### Scan and Bind

1. Navigate to the Scan and Bind module.
2. Use the barcode scanner to scan a device's barcode.
3. The application will attempt to match the scanned barcode with the list of discovered BLE devices.
4. If a match is found, bind the device for future interactions.

### WebView Frontend

- Access a responsive, modern UI for interacting with BLE devices and managing bindings.
- Use navigation tabs to switch between BLE scanning and barcode binding modules.

### Offline Mode

- Perform BLE scanning and barcode binding even without an internet connection.
- Data synchronization with the MQTT broker occurs once the connection is restored.

---

## Development Workflow

### Running the Web Application Locally

1. Navigate to the `web` directory:
   ```bash
   cd web
   ```
2. Start the development server:
   ```bash
   npx vite
   ```
3. Open the application in your browser at `http://localhost:5173`.

### Debugging the Android Application

1. Run the application on a physical device or emulator in Android Studio.
2. Use the "Logcat" feature in Android Studio to view logs for BLE and WebView activities.

---

## Testing

### Unit Tests

- Run unit tests for the React application:
  ```bash
  npm test
  ```

### Manual Testing

1. Test BLE scanning functionality on a physical Android device.
2. Test barcode scanning and binding functionality.
3. Verify MQTT data publishing using an MQTT client.
4. Test offline functionality by disconnecting from the internet and performing BLE scanning and barcode binding.

---

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your feature description"
   ```
4. Push the branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Create a pull request in the main repository.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.
