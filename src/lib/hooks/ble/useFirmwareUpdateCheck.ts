"use client";

import { useEffect, useRef, useState } from "react";
import apolloClient from "@/lib/apollo-client";
import {
  GET_ALL_ITEM_FIRMWARES,
  GET_DEVICE_SNAPSHOT_WITH_GATT_META,
  ItemFirmware,
} from "@/lib/graphql/firmware";

/**
 * Automatic firmware-update check for a connected BLE device.
 *
 * Chain (every link must hold, otherwise we stay silent and the manual
 * Update Firmware flow remains the only path):
 *   1. BLE gives us the device's opid (= cloud oemItemId) and current fwv.
 *   2. getDeviceSnapshotWithGattMeta(opid) → gatt_meta.firmware = the
 *      firmware FAMILY this device runs.
 *   3. Catalog entries (getAllItemFirmwares) whose actorName equals that
 *      family (case-insensitive) are candidates.
 *   4. Versions on both sides must contain a dotted numeric group
 *      (e.g. "1.0.3" out of "UBP2K_V1.0.3"); highest candidate wins.
 *   5. Prompt only if candidate > device, and the user hasn't dismissed
 *      that exact version for this device before.
 *
 * ASSUMPTION pending backend confirmation (Bob): gatt_meta.firmware and
 * ItemFirmware.actorName use the same naming. If that turns out to be wrong,
 * fix matchesFirmwareFamily() below — nothing else depends on it.
 */

/** Extract the first dotted numeric group, e.g. "V1.2.10" → [1, 2, 10]. */
export const parseVersionNumbers = (raw: string | null | undefined): number[] | null => {
  if (!raw) return null;
  const match = String(raw).match(/(\d+(?:\.\d+)+)/);
  if (!match) return null;
  return match[1].split(".").map(Number);
};

/** 1 if a > b, -1 if a < b, 0 if equal (compared segment-wise). */
export const compareVersionNumbers = (a: number[], b: number[]): number => {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
};

export const matchesFirmwareFamily = (fw: ItemFirmware, family: string): boolean =>
  !!fw.actorName && fw.actorName.trim().toUpperCase() === family.trim().toUpperCase();

const dismissKey = (macAddress: string) => `otaDismissedVersion_${macAddress}`;

export interface FirmwareUpdateCheck {
  /** Newest matching catalog entry that is newer than the device, or null */
  updateAvailable: ItemFirmware | null;
  /** gatt_meta.firmware for diagnostics/UI */
  firmwareFamily: string | null;
  /** Remember "not now" for this device+version and hide the prompt */
  dismiss: () => void;
}

export function useFirmwareUpdateCheck(
  macAddress: string,
  opid: string | null,
  currentFwv: string | null
): FirmwareUpdateCheck {
  const [updateAvailable, setUpdateAvailable] = useState<ItemFirmware | null>(null);
  const [firmwareFamily, setFirmwareFamily] = useState<string | null>(null);
  // One check per (device, reported fwv); a reconnect after flashing re-runs it.
  const checkedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!opid || !currentFwv || !macAddress) return;
    const checkId = `${macAddress}|${currentFwv}`;
    if (checkedRef.current === checkId) return;
    checkedRef.current = checkId;

    const deviceVersion = parseVersionNumbers(currentFwv);
    if (!deviceVersion) {
      console.log("[ota-check] device fwv not parseable, skipping:", currentFwv);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const snapRes = await apolloClient.query({
          query: GET_DEVICE_SNAPSHOT_WITH_GATT_META,
          variables: { oemItemId: opid },
          fetchPolicy: "network-only",
        });
        const gattMeta = snapRes.data?.getDeviceSnapshotWithGattMeta?.gatt_meta;
        const family =
          typeof gattMeta?.firmware === "string" ? gattMeta.firmware : null;
        if (cancelled) return;
        setFirmwareFamily(family);
        if (!family) {
          console.log("[ota-check] no gatt_meta.firmware for", opid, "- skipping");
          return;
        }

        const listRes = await apolloClient.query({
          query: GET_ALL_ITEM_FIRMWARES,
          variables: { first: 50 },
          fetchPolicy: "network-only",
        });
        if (cancelled) return;
        const entries: ItemFirmware[] = (
          listRes.data?.getAllItemFirmwares?.page?.edges ?? []
        )
          .map((e: any) => e?.node)
          .filter(Boolean);

        let best: ItemFirmware | null = null;
        let bestVersion: number[] | null = null;
        for (const fw of entries) {
          if (!matchesFirmwareFamily(fw, family)) continue;
          const v = parseVersionNumbers(fw.version);
          if (!v || compareVersionNumbers(v, deviceVersion) <= 0) continue;
          if (!bestVersion || compareVersionNumbers(v, bestVersion) > 0) {
            best = fw;
            bestVersion = v;
          }
        }
        if (!best) {
          console.log("[ota-check] device is up to date", { family, currentFwv });
          return;
        }
        const dismissed = localStorage.getItem(dismissKey(macAddress));
        if (dismissed === best.version) {
          console.log("[ota-check] newer version was dismissed:", best.version);
          return;
        }
        console.log("[ota-check] update available:", best.version, "over", currentFwv);
        setUpdateAvailable(best);
      } catch (err) {
        // Not logged in / unknown device / network — all mean "don't prompt".
        console.log("[ota-check] check failed, staying silent:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [macAddress, opid, currentFwv]);

  const dismiss = () => {
    if (updateAvailable) {
      try {
        localStorage.setItem(dismissKey(macAddress), updateAvailable.version);
      } catch {
        // storage full/blocked — prompt will just reappear next connect
      }
    }
    setUpdateAvailable(null);
  };

  return { updateAvailable, firmwareFamily, dismiss };
}
