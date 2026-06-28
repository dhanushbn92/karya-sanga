import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { splitIntoSlides } from "@/lib/slides";
import { PresenterDeck } from "@/components/lessons/presenter-deck";

export const metadata = { title: "Present · Yukti AI Labs" };

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

  const lesson = await prisma.lesson.findFirst({
    where: {
      id,
      // Instructors author + reorder unpublished lessons too; the gate is at
      // the lesson-list level. Presenter just needs the lesson to exist.
    },
    include: {
      module: { select: { title: true } },
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
