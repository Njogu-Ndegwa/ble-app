"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  Zap,
  Wallet,
  CreditCard,
  Copy,
  Check,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { isEnergyServiceType, isSwapCountServiceType } from "../hooks/useRiderActivity";
import type { RiderActivityItem, RiderActivityRecord } from "../types";

interface RiderActivityDetailProps {
  item: RiderActivityItem;
  currency?: string;
  planMode?: "energy-priced" | "swap-count" | "unsupported";
  onBack: () => void;
}

/**
 * Full-page detail view for one activity row (replaces the old bottom sheet,
 * which was clipped behind the bottom nav — the nav is a sibling stacking
 * context of `.rider-main`, so overlays rendered inside the main scroller can
 * never reliably cover it). Renders in the normal screen area instead:
 * receipt-style hero, human-readable detail rows, then the raw ABS record
 * references with copyable IDs for support.
 */
export default function RiderActivityDetail({
  item,
  currency,
  planMode = "unsupported",
  onBack,
}: RiderActivityDetailProps) {
  const { t } = useI18n();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // The list and this page share the `.rider-main` scroller. Open at the top,
  // and put the rider back where they were in the list when they return.
  useEffect(() => {
    const scroller = document.querySelector(".rider-main");
    const prevScrollTop = scroller?.scrollTop ?? 0;
    scroller?.scrollTo({ top: 0 });
    return () => {
      scroller?.scrollTo({ top: prevScrollTop });
    };
  }, []);

  const handleCopyId = useCallback(async (id: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(id);
      } else {
        // Fallback for WebViews without the modern clipboard API.
        const ta = document.createElement("textarea");
        ta.value = id;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1500);
    } catch (err) {
      console.warn("[RiderActivityDetail] Clipboard copy failed:", err);
    }
  }, []);

  const records = item.records || [];
  const energyRecord = records.find(
    (r) => r.kind === "service" && isEnergyServiceType(r.type),
  );
  const swapCountRecord = records.find(
    (r) => r.kind === "service" && isSwapCountServiceType(r.type),
  );

  const cur = item.currency || currency || "";
  const moneyLabel = (amount: number, signed = false) =>
    `${signed ? (item.isPositive ? "+" : "-") : ""}${cur ? `${cur} ` : ""}${Math.abs(
      amount,
    ).toLocaleString()}`;

  const heroIcon =
    item.type === "swap" ? (
      <Zap size={24} />
    ) : item.type === "topup" ? (
      <Wallet size={24} />
    ) : (
      <CreditCard size={24} />
    );

  const swapCount = item.swapCount ?? Math.max(1, Math.floor(swapCountRecord?.amount || 1));

  // Lead with the unit this plan sells. Keep both raw service records in the
  // receipt below so support can still inspect energy and counter deductions.
  const heroValue =
    item.type === "swap"
      ? planMode === "swap-count"
        ? t("rider.swapCountValue", { count: swapCount }) || `${swapCount} swap`
        : item.energy ||
          (energyRecord ? `${energyRecord.amount} kWh` : item.title)
      : item.amount !== undefined
        ? moneyLabel(item.amount, true)
        : item.title;

  const dateLabel = new Date(item.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const refLabel = (r: RiderActivityRecord) =>
    r.kind === "payment"
      ? t("rider.activity.paymentRecord") || "Payment record"
      : isEnergyServiceType(r.type)
        ? t("rider.activity.energyRecord") || "Energy usage record"
        : isSwapCountServiceType(r.type)
          ? t("rider.activity.swapCountRecord") || "Swap counter record"
          : t("rider.activity.serviceRecord") || "Service record";

  const refAmount = (r: RiderActivityRecord) =>
    r.kind === "payment"
      ? moneyLabel(r.amount)
      : isEnergyServiceType(r.type)
        ? `${r.amount} kWh`
        : isSwapCountServiceType(r.type)
          ? `+${r.amount}`
          : String(r.amount);

  return (
    <div className="rider-screen active rad-screen">
      <div className="rad-header">
        <button
          type="button"
          className="rad-back"
          onClick={onBack}
          aria-label={t("common.back") || "Back"}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="rad-header-title">
          {t("rider.activity.detailsTitle") || "Activity Details"}
        </span>
      </div>

      {/* Receipt hero — the one number that matters, then what/when. */}
      <div className="rad-hero">
        <div className="rad-hero-icon">{heroIcon}</div>
        <div className="rad-hero-value">{heroValue}</div>
        <div className="rad-hero-title">{item.title}</div>
        <div className="rad-hero-sub">
          {dateLabel} · {item.time}
        </div>
      </div>

      {/* Human-readable summary rows. */}
      <div className="rad-section-label">
        {t("rider.activity.detailsSection") || "Details"}
      </div>
      <div className="rad-card">
        <div className="rad-row">
          <span className="rad-row-label">
            {t("rider.activity.recordType") || "Type"}
          </span>
          <span className="rad-row-value">{item.title}</span>
        </div>
        {item.subtitle && item.subtitle !== item.title && (
          <div className="rad-row">
            <span className="rad-row-label">
              {t("rider.activity.description") || "Description"}
            </span>
            <span className="rad-row-value">{item.subtitle}</span>
          </div>
        )}
        <div className="rad-row">
          <span className="rad-row-label">
            {t("rider.activity.date") || "Date"}
          </span>
          <span className="rad-row-value">{dateLabel}</span>
        </div>
        <div className="rad-row">
          <span className="rad-row-label">
            {t("rider.activity.time") || "Time"}
          </span>
          <span className="rad-row-value">{item.time}</span>
        </div>
        {energyRecord && (
          <div className="rad-row">
            <span className="rad-row-label">
              {t("rider.activity.energyDelivered") || "Energy delivered"}
            </span>
            <span className="rad-row-value">{energyRecord.amount} kWh</span>
          </div>
        )}
        {swapCountRecord && (
          <div className="rad-row">
            <span className="rad-row-label">
              {t("rider.activity.swapCounter") || "Swap counter"}
            </span>
            <span className="rad-row-value">+{swapCountRecord.amount}</span>
          </div>
        )}
        {item.type !== "swap" && item.amount !== undefined && (
          <div className="rad-row">
            <span className="rad-row-label">
              {t("rider.activity.amount") || "Amount"}
            </span>
            <span className="rad-row-value">{moneyLabel(item.amount, true)}</span>
          </div>
        )}
      </div>

      {/* Raw ABS records — the IDs support needs to trace a transaction. */}
      {records.length > 0 && (
        <>
          <div className="rad-section-label">
            {t("rider.activity.references") || "Record references"}
          </div>
          <div className="rad-card">
            {records.map((r) => (
              <div className="rad-ref" key={r.id || r.createdAt}>
                <div className="rad-ref-head">
                  <span className="rad-ref-kind">{refLabel(r)}</span>
                  <span className="list-card-badge list-card-badge--default">
                    {refAmount(r)}
                  </span>
                </div>
                <button
                  type="button"
                  className="rad-ref-id"
                  onClick={() => r.id && handleCopyId(r.id)}
                  aria-label={t("rider.activity.copyId") || "Copy ID"}
                >
                  <code>{r.id || "—"}</code>
                  {copiedId === r.id && r.id ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
                <div className="rad-ref-meta">
                  <span>{t("rider.activity.recordedAt") || "Recorded at"}</span>
                  <span>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
