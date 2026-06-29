import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, lesson as lessonTable } from "@/lib/db";
import { splitIntoSlides } from "@/lib/slides";
import { PresenterDeck } from "@/components/lessons/presenter-deck";

export const metadata = { title: "Present · Karya Sanga" };

/**
 * Presenter mode for a lesson. The whole route is wrapped in `dark` so it
 * uses the Modern Ashram contemplative theme regardless of the rest of the
 * app's light Youth Edition. The TopNav is hidden via a different layout.
 */
export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  // Instructors author + reorder unpublished lessons too; the gate is at
  // the lesson-list level. Presenter just needs the lesson to exist.
  const lesson = await db.query.lesson.findFirst({
    where: eq(lessonTable.id, id),
    with: {
      module: { columns: { title: true } },
    },
  });
  if (!lesson) notFound();

  const slides = splitIntoSlides(lesson.body);

  return (
    <PresenterDeck
      slides={slides}
      lessonTitle={lesson.title}
      lessonModule={lesson.module.title}
      lessonId={lesson.id}
    />
  );
}
