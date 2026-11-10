import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export const buttonVariants = cva("action", {
  variants: {
    variant: {
      default: "action-primary",
      outline: "action-outline",
      ghost: "action-ghost",
      destructive: "action-danger",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Button({
  className,
  variant,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      type={type}
      className={twMerge(clsx(buttonVariants({ variant }), className))}
      {...props}
    />
  );
}
