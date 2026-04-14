import React from 'react';

export interface ChipProps {
  label: React.ReactNode;
  value?: React.ReactNode;
  accent?: string;
  accentText?: string;
  selected?: boolean;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md';
  title?: string;
  className?: string;
  children?: React.ReactNode;
  as?: 'button' | 'span';
  disabled?: boolean;
}

const SIZE_CLS: Record<NonNullable<ChipProps['size']>, string> = {
  xs: 'text-[10px] px-2 py-0.5 gap-1',
  sm: 'text-xs px-2.5 py-1 gap-1.5',
  md: 'text-xs px-3 py-1.5 gap-2 min-h-[32px]',
};

export function Chip({
  label,
  value,
  accent,
  accentText,
  selected,
  onClick,
  size = 'sm',
  title,
  className = '',
  children,
  as,
  disabled,
}: ChipProps) {
  const Tag = (as ?? (onClick ? 'button' : 'span')) as 'button' | 'span';
  const clickable = !!onClick && !disabled;

  const base =
    'inline-flex items-center rounded-full font-medium transition-colors select-none shrink-0';
  const sizeCls = SIZE_CLS[size];
  const stateCls = selected
    ? 'bg-indigo-900/50 ring-1 ring-indigo-500 text-white'
    : 'bg-gray-800/60 text-gray-200';
  const hoverCls = clickable ? 'hover:bg-gray-700/80 cursor-pointer' : '';
  const disabledCls = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <Tag
      {...(Tag === 'button' ? { type: 'button' as const, disabled } : {})}
      onClick={clickable ? onClick : undefined}
      title={title}
      className={`${base} ${sizeCls} ${stateCls} ${hoverCls} ${disabledCls} ${className}`}
    >
      {accent && (
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: accent }}
        />
      )}
      {label !== undefined && label !== null && (
        <span
          className="font-semibold whitespace-nowrap"
          style={accentText ? { color: accentText } : undefined}
        >
          {label}
        </span>
      )}
      {value !== undefined && value !== null && (
        <span className="text-gray-400 whitespace-nowrap">{value}</span>
      )}
      {children}
    </Tag>
  );
}

/**
 * ActionChip - chip with colored action tag inside (for TOP10 / confusion).
 */
export function ActionChip({
  actionLabel,
  actionBg,
  actionText,
  strike = false,
  size = 'xs',
}: {
  actionLabel: string;
  actionBg: string;
  actionText: string;
  strike?: boolean;
  size?: 'xs' | 'sm';
}) {
  const sizeCls = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  return (
    <span
      className={`rounded font-medium shrink-0 ${sizeCls} ${strike ? 'line-through opacity-60' : ''}`}
      style={{ backgroundColor: actionBg, color: actionText }}
    >
      {actionLabel}
    </span>
  );
}
