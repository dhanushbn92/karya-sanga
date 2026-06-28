/**
 * Presenter mode wrapper.
 *
 * Two jobs:
 *  1. Force the dark "Modern Ashram" theme via the `dark` class — instructors
 *     project this on a wall or share screen, and the contemplative dark
 *     surface is easier on a crowd of eyes than the kid-friendly light theme.
 *  2. Cover the global TopNav with a full-viewport fixed wrapper. The
 *     presenter screen has its own top + bottom bars; the site nav above is
 *     just chrome we'd rather suppress for the live workshop. `fixed inset-0`
 *     stacks above and the dark theme + bg-background fully obscures it.
 *
 * Hit `F` while presenting to go true browser-fullscreen.
 */
export default function PresenterLayout({
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
