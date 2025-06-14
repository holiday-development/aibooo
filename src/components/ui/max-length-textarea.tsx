import { ComponentPropsWithRef } from 'react';
import { Textarea } from './textarea';
import { cn } from '@/lib/utils';

interface MaxLengthTextareaProps
  extends Omit<ComponentPropsWithRef<typeof Textarea>, 'value'> {
  value: string;
  maxLength: number;
}

export function MaxLengthTextarea({
  className,
  maxLength,
  value,
  ...props
}: MaxLengthTextareaProps) {
  const overflow = value.length > maxLength;

  return (
    <div className="relative w-full h-full">
      <Textarea
        className={className}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      <span
        className={cn(
          'absolute bottom-2 right-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded shadow',
          overflow && 'text-red-500'
        )}
      >
        {value.length} / {maxLength}
      </span>
    </div>
  );
}
