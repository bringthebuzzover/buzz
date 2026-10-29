import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../../theme/cn";

/** Shared with `AdminTable` so the admin grid and this primitive don't drift. */
export const tableHeadClass =
  "px-4 py-2 text-left text-xs font-normal text-buzz-inkMuted";

export const tableCellClass = "px-4 py-3 text-sm text-buzz-fg";

export function Table({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-buzz-line", className)} {...rest} />;
}

export function TBody({
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...rest} />;
}

export function Tr({
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-buzz-line last:border-0", className)} {...rest} />
  );
}

export function Th({
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn(tableHeadClass, className)} {...rest} />;
}

export function Td({
  className,
  muted = false,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { muted?: boolean }) {
  return (
    <td
      className={cn(tableCellClass, muted && "text-xs text-buzz-inkMuted", className)}
      {...rest}
    />
  );
}
