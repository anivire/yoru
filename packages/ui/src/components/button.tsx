import { type VariantProps, cva } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'
import { Spinner } from './spinner'

export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-medium zoom-layer transition-[background-color,color,box-shadow,opacity,transform] duration-150 ease-out active:[--zoom:0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-inverse text-inverse-foreground hover:opacity-90',
        accent: 'bg-accent text-accent-foreground hover:opacity-90',
        secondary: 'bg-field text-foreground hover:bg-field-hover',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        outline: 'bg-transparent text-foreground hover:bg-field',
        danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
        link: 'h-auto px-0 text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-[13px] [&_svg]:size-3.5',
        md: 'h-9 rounded-lg px-4 text-sm [&_svg]:size-4',
        lg: 'h-11 rounded-full px-6 text-[15px] [&_svg]:size-4',
        icon: 'size-9 rounded-lg [&_svg]:size-4',
        'icon-sm': 'size-8 rounded-md [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }

export function Button({ className, variant, size, asChild, loading, disabled, children, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot.Root>
    )
  }
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}
