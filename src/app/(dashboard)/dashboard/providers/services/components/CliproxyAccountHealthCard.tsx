"use client";

import { useCallback, useEffect, useState } from "react";
<<<<<<< HEAD
=======
import { useTranslations } from "next-intl";
>>>>>>> upstream/main
import { Badge, Button, Card } from "@/shared/components";
import type {
  CliproxyAccountHealth,
  CliproxyAccountHealthResult,
} from "@/lib/services/cliproxyAccountHealth";

<<<<<<< HEAD
const STATE_LABELS: Record<CliproxyAccountHealthResult["state"], string> = {
  ready: "Account health",
  disabled: "CLIProxyAPI is not installed",
  missing_key: "Management key is not configured",
  unreachable: "Management API is unreachable",
  unauthorized: "Management key was rejected",
  unsupported: "This CLIProxyAPI version does not expose account health",
  invalid_response: "Management API returned an unsupported response",
};

function AccountRow({ account }: { account: CliproxyAccountHealth }) {
  const state = account.disabled ? "Disabled" : account.unavailable ? "Unavailable" : account.status;
=======
function stateLabels(
  t: ReturnType<typeof useTranslations>
): Record<CliproxyAccountHealthResult["state"], string> {
  return {
    ready: t("stateReady"),
    disabled: t("stateDisabled"),
    missing_key: t("stateMissingKey"),
    unreachable: t("stateUnreachable"),
    unauthorized: t("stateUnauthorized"),
    unsupported: t("stateUnsupported"),
    invalid_response: t("stateInvalidResponse"),
  };
}

function AccountRow({ account }: { account: CliproxyAccountHealth }) {
  const state = account.disabled
    ? "Disabled"
    : account.unavailable
      ? "Unavailable"
      : account.status;
>>>>>>> upstream/main
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-text-main">
            {account.label || account.authIndex}
          </span>
          <Badge variant={account.disabled || account.unavailable ? "warning" : "success"}>
            {state || "Unknown"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {[account.provider || account.type, account.label ? account.authIndex : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="text-right text-xs text-text-muted">
        <div>{account.success.toLocaleString()} succeeded</div>
        <div>{account.failed.toLocaleString()} failed</div>
      </div>
    </li>
  );
}

<<<<<<< HEAD
export function CliproxyAccountHealthCard() {
=======
// Network + parse concerns live outside the component so the load callback only
// sets state after the await (no synchronous setState reachable from the effect).
async function fetchAccountHealth(): Promise<CliproxyAccountHealthResult> {
  try {
    const response = await fetch("/api/services/cliproxy/accounts", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    return { state: "unreachable", accounts: [], version: null };
  }
}

export function CliproxyAccountHealthCard() {
  const t = useTranslations("cliproxyHealth");
>>>>>>> upstream/main
  const [result, setResult] = useState<CliproxyAccountHealthResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
<<<<<<< HEAD
    setLoading(true);
    try {
      const response = await fetch("/api/services/cliproxy/accounts", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setResult(await response.json());
    } catch {
      setResult({ state: "unreachable", accounts: [], version: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card
      title="CLIProxyAPI accounts"
      subtitle="Read-only status from the authenticated management API"
      action={
        <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
          Refresh
=======
    const next = await fetchAccountHealth();
    setResult(next);
    setLoading(false);
  }, []);

  // Inline-in-effect (calling the component-scope `load` callback synchronously
  // from an effect is rejected by the compiler rules); setState is post-await.
  useEffect(() => {
    const run = async () => {
      const next = await fetchAccountHealth();
      setResult(next);
      setLoading(false);
    };
    void run();
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    void load();
  };

  return (
    <Card
      title={t("cardTitle")}
      subtitle={t("cardSubtitle")}
      action={
        <Button variant="secondary" size="sm" onClick={handleRefresh} loading={loading}>
          {t("btnRefresh")}
>>>>>>> upstream/main
        </Button>
      }
    >
      {result?.state === "ready" ? (
        result.accounts.length > 0 ? (
<<<<<<< HEAD
          <ul aria-label="CLIProxyAPI account health">
=======
          <ul aria-label={t("listAria")}>
>>>>>>> upstream/main
            {result.accounts.map((account) => (
              <AccountRow key={account.authIndex} account={account} />
            ))}
          </ul>
        ) : (
<<<<<<< HEAD
          <p className="text-sm text-text-muted">No CLIProxyAPI accounts found.</p>
        )
      ) : (
        <p className="text-sm text-text-muted">
          {loading && !result ? "Loading account health…" : STATE_LABELS[result?.state ?? "unreachable"]}
=======
          <p className="text-sm text-text-muted">{t("noAccounts")}</p>
        )
      ) : (
        <p className="text-sm text-text-muted">
          {loading && !result ? t("loading") : stateLabels(t)[result?.state ?? "unreachable"]}
>>>>>>> upstream/main
        </p>
      )}
    </Card>
  );
}
