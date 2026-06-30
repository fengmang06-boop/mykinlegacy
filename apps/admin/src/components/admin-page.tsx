import Link from "next/link";
import React from "react";

import { canMutate, type AdminRole } from "../lib/rbac";

export function AdminPage({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="eyebrow">Admin Operations</p>
      <h1>{title}</h1>
      <p className="notice">{description}</p>
      {children}
    </section>
  );
}

export function PermissionNotice({ role, minimum }: { role: AdminRole; minimum: AdminRole }) {
  const allowed = canMutate(role, minimum);
  return (
    <p className={allowed ? "notice" : "notice danger"}>
      {allowed ? "Action available for this role." : "Insufficient permission. Mutation button disabled."}
    </p>
  );
}

export function ReasonedAction({
  label,
  minimumRole,
  currentRole = "viewer",
  costWarning = false,
  destructive = false
}: {
  label: string;
  minimumRole: AdminRole;
  currentRole?: AdminRole;
  costWarning?: boolean;
  destructive?: boolean;
}) {
  const allowed = canMutate(currentRole, minimumRole);
  return (
    <div className="card">
      <h3>{label}</h3>
      <label>
        Reason required
        <textarea placeholder="Internal reason required before submitting" />
      </label>
      {costWarning ? <p className="danger">Cost warning: retry may create additional AI cost.</p> : null}
      {destructive ? <p className="danger">Destructive action: confirmation required.</p> : null}
      <button className="button" type="button" disabled={!allowed}>
        {allowed ? label : "Permission required"}
      </button>
    </div>
  );
}

export function DataTable({ rows }: { rows: Array<Record<string, string | number | null>> }) {
  const keys = Object.keys(rows[0] ?? {});
  return (
    <table>
      <thead>
        <tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {keys.map((key) => <td key={key}>{row[key] ?? ""}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DetailLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href}>{children}</Link>;
}
