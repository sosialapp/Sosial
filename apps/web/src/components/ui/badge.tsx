import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** shadcn-style Badge on brand tokens (same vocabulary as .pill). */
const badgeVariants = cva(
  'pill transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface text-soft',
        accent: 'bg-accent-soft text-accent-ink',
        success: 'bg-[#EDF3EC] text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]',
        danger: 'bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]',
        outline: 'border border-line bg-transparent text-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
