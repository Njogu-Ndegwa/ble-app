"use client";

import React, { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { readBleCharacteristic, writeBleCharacteristic } from "../../../utils";
import { Toaster, toast } from "react-hot-toast";
import { ArrowLeft, Share2, RefreshCw, Clipboard } from "lucide-react";
import { AsciiStringModal, NumericModal } from "../../../modals";
import HeartbeatView from "@/components/HeartbeatView";
import { useI18n } from "@/i18n";

interface DeviceDetailProps {
  device: {
    macAddress: string;
    name: string;
    rssi: string;
    imageUrl?: string;
  };
  attributeList: any[];
  onBack?: () => void;
  onRequestServiceData?: (serviceName: string) => void;
  isLoadingService?: string | null;
  serviceLoadingProgress?: number;
  handlePublish?: (attributeList: any, serviceType: string) => void;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
  serviceLoadingProgress = 0,
  handlePublish,
}) => {
  const router = useRouter();
  const { t } = useI18n();
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>(
    {}
  );
  const [loadingStates, setLoadingStates] = useState<{
    [key: string]: boolean;
  }>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("ATT");

  // Persist initial data load and heartbeat sent state across HeartbeatView mounts
  const initialDataLoadedRef = useRef<boolean>(false);
  const heartbeatSentRef = useRef<boolean>(false);

  const fixedTabs = [
    { id: "ATT", label: "ATT", serviceNameEnum: "ATT_SERVICE" },
    { id: "CMD", label: "CMD", serviceNameEnum: "CMD_SERVICE" },
    { id: "STS", label: "STS", serviceNameEnum: "STS_SERVICE" },
    { id: "DTA", label: "DTA", serviceNameEnum: "DTA_SERVICE" },
    { id: "DIA", label: "DIA", serviceNameEnum: "DIA_SERVICE" },
    { id: "HEARTBEAT", label: "HB", serviceNameEnum: null },
  ];

  // Define activeService before useMemo
  const activeService = attributeList.find((service) =>
    fixedTabs.find(
      (tab) =>
        tab.id === activeTab && tab.serviceNameEnum === service.serviceNameEnum
    )
  );

  // Extract OPID and sort DIA service characteristics
  const { opidCharacteristic, sortedCharacteristics } = useMemo(() => {
    const foundAtt = attributeList.find(
      (service) => service.serviceNameEnum === "ATT_SERVICE"
    );
    const opidChar =
      foundAtt?.characteristicList?.find(
        (c: any) => c.name.toLowerCase() === "opid"
      ) ?? null;

    // Sort DIA service characteristics
    let sortedChars = activeService?.characteristicList || [];
    if (activeService?.serviceNameEnum === "DIA_SERVICE") {
      sortedChars = [...sortedChars].sort((a, b) => {
        // Extract numeric part from name (e.g., 'cv01' -> 1, 'cv02' -> 2)
        const aNum = parseInt(a.name.replace("cv", ""), 10);
        const bNum = parseInt(b.name.replace("cv", ""), 10);
        // Handle non-cell characteristics (e.g., pkt1, pkt2)
        if (isNaN(aNum) && isNaN(bNum)) return a.name.localeCompare(b.name); // Sort temperatures alphabetically
        if (isNaN(aNum)) return 1; // Push non-cell (e.g., pkt) to the end
        if (isNaN(bNum)) return -1;
        return aNum - bNum; // Sort numerically for cell voltages
      });
    }

    return { opidCharacteristic: opidChar, sortedCharacteristics: sortedChars };
  }, [attributeList, activeTab]);

  const formatValue = (characteristic: any) => {
    if (!characteristic) return t("N/A");
    if (typeof characteristic.realVal === "number") {
      switch (characteristic.valType) {
        case 0:
          return characteristic.realVal;
        case 1:
          // Check if the characteristic is a temperature (name starts with 'pkt' or desc contains 'Celsius')
          if (
            characteristic.name.toLowerCase().startsWith("pkt") ||
            characteristic.desc.toLowerCase().includes("celsius")
          ) {
            return t("{value} °C", { value: String(characteristic.realVal) });
          }
          return t("{value} mA", { value: String(characteristic.realVal) });
        case 2:
          return t("{value} mV", { value: String(characteristic.realVal) });
        default:
          return characteristic.realVal;
      }
    }
    return characteristic.realVal || t("N/A");
  };

  // Get display value
  const getDisplayValue = (char: any) => {
    if (!char) return null; // Return null instead of 'N/A' for header
    return updatedValues[char.uuid] !== undefined
      ? updatedValues[char.uuid]
      : formatValue(char);
  };

  const isServiceLoaded = (serviceNameEnum: string) => {
    return attributeList.some(
      (service) => service.serviceNameEnum === serviceNameEnum
    );
  };

  // Request ATT service on mount to ensure OPID is available
  React.useEffect(() => {
    if (onRequestServiceData && !isServiceLoaded("ATT_SERVICE")) {
      onRequestServiceData("ATT");
    }
  }, [onRequestServiceData, isServiceLoaded]);

  const handleBack = () => (onBack ? onBack() : router.back());

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const tab = fixedTabs.find((t) => t.id === tabId);
    if (!tab || !tab.serviceNameEnum || tabId === "HEARTBEAT") return;
    const serviceNameEnum = tab.serviceNameEnum;
    if (!isServiceLoaded(serviceNameEnum) && onRequestServiceData) {
      onRequestServiceData(tabId);
    }
  };

  const handleRead = (
    serviceUuid: string,
    characteristicUuid: string,
    name: string
  ) => {
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
    readBleCharacteristic(
      serviceUuid,
      characteristicUuid,
      device.macAddress,
      (data: any, error: any) => {
        setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
        if (data) {
          console.info(data.realVal, "Value of Field");
          toast.success(`${name} read successfully`);
          setUpdatedValues((prev) => ({
            ...prev,
            [characteristicUuid]: data.realVal,
          }));
        } else {
          console.error("Error Reading Characteristics");
          toast.error(`Failed to read ${name}`);
        }
      }
    );
  };

  const handleWriteClick = (characteristic: any) => {
    setActiveCharacteristic(characteristic);
    if (
      characteristic.name.toLowerCase().includes("pubk") ||
      characteristic.name.toLowerCase().includes("napn")
    ) {
      setAsciiModalOpen(true);
    } else {
      setNumericModalOpen(true);
    }
  };

  const handleWrite = (value: string | number) => {
    if (!activeCharacteristic || !activeService) return;
    
    // Verify device is still connected before attempting write
    const connectedMac = sessionStorage.getItem("connectedDeviceMac");
    if (!connectedMac || connectedMac !== device.macAddress) {
      toast.error(t("Device not connected. Please reconnect and try again."));
      return;
    }
    
    console.info({
      action: "write",
      serviceUuid: activeService.uuid,
      characteristicUuid: activeCharacteristic.uuid,
      macAddress: device.macAddress,
      name: device.name,
      value: value,
    });
    
    // Set loading state
    setLoadingStates((prev) => ({ ...prev, [activeCharacteristic.uuid]: true }));
    
    writeBleCharacteristic(
      activeService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      (responseData: any) => {
        setLoadingStates((prev) => ({ ...prev, [activeCharacteristic.uuid]: false }));
        console.info({ writeResponse: responseData });
        
        // Parse response to check if write succeeded
        let writeSuccess = false;
        let errorMessage = null;
        
        try {
          // Handle different response formats
          let response: any;
          
          if (typeof responseData === 'string') {
            try {
              response = JSON.parse(responseData);
            } catch (e) {
              // If it's a plain string, check if it indicates success
              if (responseData.toLowerCase() === "success" || responseData.toLowerCase() === "ok") {
                writeSuccess = true;
              } else {
                errorMessage = responseData;
              }
            }
          } else {
            response = responseData;
          }
          
          // Check if write was successful based on response structure
          if (response) {
            if (response.respCode === "200" || response.respCode === 200) {
              writeSuccess = true;
            } else if (response.respData === true || response.respData === "success") {
              writeSuccess = true;
            } else if (response.success === true) {
              writeSuccess = true;
            } else if (response.respDesc) {
              errorMessage = response.respDesc;
            } else if (response.error) {
              errorMessage = response.error;
            } else if (response.message) {
              errorMessage = response.message;
            }
          }
        } catch (e) {
          console.error("Error parsing write response:", e);
          errorMessage = "Unknown write response format";
        }
        
        if (writeSuccess) {
          toast.success(t("Value written to {name}", { name: activeCharacteristic.name }));
          // Wait longer for write to fully complete before reading (BLE operations need time)
          setTimeout(() => {
            // Verify connection again before read
            const stillConnected = sessionStorage.getItem("connectedDeviceMac");
            if (stillConnected === device.macAddress) {
              handleRead(activeService.uuid, activeCharacteristic.uuid, device.name);
            } else {
              toast.error(t("Device disconnected. Please reconnect."));
            }
          }, 2000); // Increased to 2000ms for better reliability with multiple devices
        } else {
          console.error("Write failed:", errorMessage || "Unknown error");
          toast.error(
            t("Failed to write {name}: {error}", {
              name: activeCharacteristic.name,
              error: errorMessage || t("Write operation failed"),
            })
          );
        }
      }
    );
  };

  const handleRefreshService = () => {
    if (!activeTab || !onRequestServiceData) return;
    onRequestServiceData(activeTab);
  };

  // Show OPID instead of device.name
  const deviceDisplayName =
    getDisplayValue(opidCharacteristic) || device.name || t("Unknown Device");

  return (
    <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)' }}>
      <Toaster />
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={
          activeCharacteristic?.name ||
          t("Public Key / Last Code / GPRS Carrier APN Name")
        }
      />
      <NumericModal
        isOpen={numericModalOpen}
        onClose={() => setNumericModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || t("Read")}
      />
      <div className="p-4 flex items-center max-w-md mx-auto">
        <button onClick={handleBack} className="mr-4 flow-header-back">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{t("Device Details")}</h1>
        <Share2 className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
      </div>
      <div className="flex flex-col items-center p-6 pb-2 max-w-md mx-auto">
        <img
          src={device.imageUrl}
          alt={deviceDisplayName}
          className="w-40 h-40 object-contain mb-4"
        />
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{deviceDisplayName}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {device.macAddress || t("Unknown MAC")}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {device.rssi || t("Unknown RSSI")}
        </p>
      </div>
      <div className="border-b max-w-md mx-auto" style={{ borderColor: 'var(--border)' }}>
        <div className="flex justify-between px-1">
          {fixedTabs.map((tab) => {
            const serviceLoaded = tab.serviceNameEnum
              ? isServiceLoaded(tab.serviceNameEnum)
              : true;
            return (
              <button
                key={tab.id}
                className={`py-3 px-3 text-sm font-medium relative ${
                  isLoadingService === tab.id ? "animate-pulse" : ""
                }`}
                style={{
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                }}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ background: 'var(--accent)' }} />
                )}
                {!serviceLoaded &&
                  tab.id === activeTab &&
                  tab.id !== "HEARTBEAT" && (
                    <div className="absolute top-1 right-0 w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }}></div>
                  )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4 max-w-md mx-auto">
        {isLoadingService === activeTab && (
          <div className="w-full h-1 mb-4 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div
              className="h-full transition-all duration-300 ease-in-out"
              style={{ width: `${serviceLoadingProgress}%`, background: 'var(--accent)' }}
            ></div>
          </div>
        )}
        {activeTab === "HEARTBEAT" ? (
          <HeartbeatView
            attributeList={attributeList}
            onRequestServiceData={onRequestServiceData || (() => {})}
            isLoading={isLoadingService !== null}
            handlePublish={handlePublish}
            initialDataLoadedRef={initialDataLoadedRef}
            heartbeatSentRef={heartbeatSentRef}
          />
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                {t("{tab} Service", { tab: activeTab })}
              </h3>
              <div
                onClick={handleRefreshService}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                  isLoadingService ? "animate-spin" : ""
                }`}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  cursor: isLoadingService ? 'not-allowed' : 'pointer',
                  opacity: isLoadingService ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isLoadingService) {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.color = 'var(--accent)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoadingService) {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }
                }}
              >
                <RefreshCw size={16} />
              </div>
            </div>
            {activeService ? (
              <div className="space-y-4">
                {sortedCharacteristics.map((char: any) => (
                  <div
                    key={char.uuid}
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
                  >
                    <div className="flex justify-between items-center px-4 py-2" style={{ background: 'var(--bg-tertiary)' }}>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{char.name}</span>
                      <div className="flex space-x-2">
                        <button
                          className={`btn btn-secondary text-xs`}
                          style={{ padding: '4px 12px', fontSize: '11px' }}
                          onClick={() =>
                            handleRead(activeService.uuid, char.uuid, char.name)
                          }
                          disabled={loadingStates[char.uuid]}
                        >
                          {loadingStates[char.uuid]
                            ? t("ble.detail.reading")
                            : t("ble.detail.read")}
                        </button>
                        {activeTab === "CMD" && (
                          <button
                            className="btn btn-primary text-xs"
                            style={{ padding: '4px 12px', fontSize: '11px' }}
                            onClick={() => handleWriteClick(char)}
                          >
                            {t("ble.detail.write")}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <div>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {t("Description")}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{t(char.desc)}</p>
                      </div>
                      <div className="flex items-center justify-between group">
                        <div className="flex-grow">
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {t("Current Value")}
                          </p>
                          <p className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                            {updatedValues[char.uuid] !== undefined
                              ? updatedValues[char.uuid]
                              : formatValue(char)}
                          </p>
                        </div>
                        <button
                          className="p-2 transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--accent)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                          onClick={() => {
                            const valueToCopy =
                              updatedValues[char.uuid] !== undefined
                                ? updatedValues[char.uuid]
                                : formatValue(char);
                            navigator.clipboard.writeText(String(valueToCopy));
                            // toast.success(t("Value copied to clipboard"));
                          }}
                          aria-label="Copy to clipboard"
                        >
                          <Clipboard size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center" style={{ color: 'var(--text-secondary)' }}>
                {isLoadingService === activeTab ? (
                  <p>
                    {t("Loading {tab} service data...", { tab: activeTab })}
                  </p>
                ) : (
                  <div>
                    <p>{t("No data available for this service")}</p>
                    {onRequestServiceData && (
                      <button
                        onClick={() => onRequestServiceData(activeTab)}
                        className="btn btn-primary"
                        style={{ marginTop: '8px', padding: '8px 16px', fontSize: '13px' }}
                      >
                        {t("Load {tab} Service Data", { tab: activeTab })}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DeviceDetailView;
