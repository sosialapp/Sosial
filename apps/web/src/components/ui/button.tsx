'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * shadcn-style Button mapped onto the brand button system (.btn base +
 * variant fills), so shadcn-built surfaces read as Sosial, not default zinc.
 */
const buttonVariants = cva(
  'btn disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'btn-primary',
        bolt: 'btn-bolt',
        ghost: 'btn-ghost',
        outline: 'border border-line bg-paper text-ink hover:bg-paper-dim',
      },
      size: {
        sm: '!px-3.5 !py-1.5 !text-xs',
        default: '',
        lg: 'btn-lg',
        icon: '!p-0 h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
