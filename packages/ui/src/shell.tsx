import type { ReactNode } from 'react';
export function Shell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
