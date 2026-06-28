/**
 * Admin / instructor routes use the dark "Modern Ashram" theme.
 * Wrapping in `dark` flips every CSS variable for descendants without
 * touching the rest of the app, which stays on the light Youth Edition.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark flex flex-1 flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
