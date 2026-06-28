/**
 * Same wrapper as the presenter mode: dark Modern Ashram theme + a fixed
 * full-viewport overlay so the global TopNav is suppressed. Lets the deck
 * viewer fill the screen, ready for projecting.
 */
export default function DeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground">
      {children}
    </div>
  );
}
