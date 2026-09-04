import type * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-[12.5px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: 'bg-primary text-white border border-primary-dark shadow-sm hover:bg-primary-dark',
        destructive: 'bg-red text-white border border-red-dark shadow-sm hover:bg-red-dark',
        outline:
          'bg-card text-secondary-foreground border border-border shadow-sm hover:bg-background-secondary hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'text-secondary-foreground hover:bg-background-secondary hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        success: 'bg-green text-white border border-green-dark shadow-sm hover:bg-green-dark',
        warning: 'bg-yellow text-white border border-yellow-dark shadow-sm hover:bg-yellow-dark',
      },
      size: {
        default: 'h-8 px-3 py-1.5 has-[>svg]:px-2.5',
        sm: 'h-7 rounded-sm gap-1 px-2.5 has-[>svg]:px-2 text-xs',
        lg: 'h-[38px] rounded-sm px-4 has-[>svg]:px-3 text-[13.5px]',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
