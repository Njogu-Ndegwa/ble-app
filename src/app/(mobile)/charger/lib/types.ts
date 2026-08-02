/** Shared shapes for the Charger Control applet. */

export interface GattCharacteristic {
  name: string;
  uuid: string;
  realVal?: unknown;
}

export interface GattService {
  serviceNameEnum?: string;
  uuid: string;
  characteristicList?: GattCharacteristic[];
}

/** A charger the operator has connected to, with its control service loaded. */
export interface ConnectedCharger {
  macAddress: string;
  name: string;
  controlService: GattService;
}
