import * as React from "react";
import { Copy } from "lucide-react";
import { Button } from "./button";
import { Textarea } from "./textarea";

interface ClipboardTextareaProps extends React.ComponentProps<typeof Textarea> {
  copyable?: boolean;
}

export function ClipboardTextarea({
  className,
  value,
  ...props
}: ClipboardTextareaProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (value === undefined) return;

    await navigator.clipboard.writeText(value as string);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Textarea className={className} value={value} {...props} />
      {isHovered && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          className="absolute bottom-2 right-2 p-2 opacity-80 hover:opacity-100"
          tabIndex={-1}
        >
          <Copy className="size-4" />
        </Button>
      )}
      {copied && (
        <span className="absolute bottom-12 right-2 text-xs bg-muted px-2 py-1 rounded shadow">
          Copied!
        </span>
      )}
    </div>
  );
}
