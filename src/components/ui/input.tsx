import * as React from "react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={`flex h-12 w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 px-4 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 transition-all ${className}`}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
