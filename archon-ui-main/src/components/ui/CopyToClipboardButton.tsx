import React, { useState, useEffect } from 'react';
import { Clipboard, Check } from 'lucide-react';

interface CopyToClipboardButtonProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
  copiedLabel?: string;
  onCopy?: () => void;
  showIcon?: boolean;
  ariaLabel?: string;
  small?: boolean;
}

// Accessible, reusable copy-to-clipboard button component.
export const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({
  value,
  children,
  className = '',
  copiedLabel = 'Copied',
  onCopy,
  showIcon = true,
  ariaLabel = 'Copy to clipboard',
  small = false
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.();
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const sizeClasses = small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:focus:ring-cyan-400/40 ${sizeClasses} ${className}`}
      data-copied={copied || undefined}
    >
      {showIcon && !copied && <Clipboard className={small ? 'w-3 h-3' : 'w-3 h-3'} />}
      {copied && <Check className={small ? 'w-3 h-3 text-green-500' : 'w-3 h-3 text-green-500'} />}
      {children && !copied && <span>{children}</span>}
      {copied && <span className="text-green-600 dark:text-green-400 font-medium">{copiedLabel}</span>}
      {!children && !copied && !showIcon && <span>Copy</span>}
    </button>
  );
};

export default CopyToClipboardButton;
