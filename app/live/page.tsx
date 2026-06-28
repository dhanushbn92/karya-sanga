import { requireUser } from "@/lib/auth";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Live sessions" };

export default async function LivePage() {
  await requireUser();
  return (
    <ComingSoon
      icon="videocam"
      title="Live sessions"
      description="Live video embeds (Zoom / Meet / Daily) ship in a later phase."
    />
  );
}
