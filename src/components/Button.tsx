import React from 'react';

type Variant = 'primary' | 'neutral' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  'px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';

const variants: Record<Variant, string> = {
  primary:
    'text-white bg-indigo-600 border border-transparent hover:bg-indigo-700 focus:ring-indigo-500',
  neutral:
    'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-indigo-500',
  danger:
    'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 focus:ring-red-500',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'neutral',
  className = '',
  ...props
}) => {
  const cls = `${base} ${variants[variant]} ${className}`.trim();
  return <button className={cls} {...props} />;
};

export default Button;
