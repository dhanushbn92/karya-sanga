import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateMyProfile } from "@/lib/actions/alumni";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata = { title: "Edit profile · Yukti AI Labs" };

export default async function ProfileSettingsPage() {
  const me = await requireUser();
  const full = await prisma.user.findUnique({ where: { id: me.id } });
  if (!full) throw new Error("User row missing");

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-4 md:px-12 py-12">
      <Link
        href={full.handle ? `/builders/${full.handle}` : "/builders"}
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        Back to my profile
      </Link>

      <div className="rotate-sticker mb-4 inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-on-tertiary-fixed shadow-sm">
        <span className="material-symbols-outlined text-[16px]">person</span>
        <span className="text-xs font-bold tracking-wide">Builder profile</span>
      </div>
      <h1 className="text-headline-lg text-on-surface">Edit your profile</h1>
      <p className="mt-2 text-on-surface-variant">
        Your handle becomes your URL (
        <code className="rounded bg-surface-container px-1.5 py-0.5 text-primary">
          /builders/yourhandle
        </code>
        ). Pick something you&apos;d link to from a college application.
      </p>

      <form
        action={updateMyProfile}
        className="sticker-shadow mt-8 grid grid-cols-1 gap-5 rounded-[32px] border-2 border-outline-variant bg-card p-6 md:p-8 md:grid-cols-12"
      >
        <label className="md:col-span-7 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Display name
          </span>
          <input
            type="text"
            name="name"
            required
            maxLength={60}
            defaultValue={full.name ?? ""}
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>
        <label className="md:col-span-5 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Handle (a-z, 0-9, -)
          </span>
          <input
            type="text"
            name="handle"
            maxLength={30}
            defaultValue={full.handle ?? ""}
            placeholder="aarav-krishnan"
            pattern="^[a-z0-9-]{3,30}$"
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>

        <label className="md:col-span-12 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Bio (max 200 chars)
          </span>
          <textarea
            name="bio"
            rows={2}
            maxLength={200}
            defaultValue={full.bio ?? ""}
            placeholder="One paragraph about what you love building."
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>

        <label className="md:col-span-8 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Building now (one line)
          </span>
          <input
            type="text"
            name="buildingNow"
            maxLength={120}
            defaultValue={full.buildingNow ?? ""}
            placeholder="A plant alarm that texts me when it&apos;s thirsty"
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>

        <label className="md:col-span-4 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Age band
          </span>
          <select
            name="ageBand"
            defaultValue={full.ageBand ?? ""}
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          >
            <option value="">—</option>
            <option value="under_15">Under 15</option>
            <option value="15-17">15–17</option>
            <option value="18-20">18–20</option>
            <option value="20+">20+</option>
          </select>
        </label>

        <label className="md:col-span-4 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Date of birth (optional)
          </span>
          <input
            type="date"
            name="dob"
            defaultValue={
              full.dob
                ? new Date(full.dob).toISOString().slice(0, 10)
                : ""
            }
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>

        <label
          htmlFor="profilePublic"
          className="md:col-span-6 flex items-center gap-3"
        >
          <input
            id="profilePublic"
            type="checkbox"
            name="profilePublic"
            defaultChecked={full.profilePublic}
            className="h-5 w-5 rounded border-2 border-outline-variant text-primary focus:ring-primary"
          />
          <span className="text-sm font-bold text-on-surface-variant">
            Make profile publicly visible
          </span>
        </label>

        <label
          htmlFor="mentorAvailable"
          className="md:col-span-6 flex items-center gap-3"
        >
          <input
            id="mentorAvailable"
            type="checkbox"
            name="mentorAvailable"
            defaultChecked={full.mentorAvailable}
            className="h-5 w-5 rounded border-2 border-outline-variant text-primary focus:ring-primary"
          />
          <span className="text-sm font-bold text-on-surface-variant">
            Available as a mentor
          </span>
        </label>

        <div className="md:col-span-12">
          <button
            type="submit"
            className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-on-primary transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            Save profile
          </button>
        </div>
      </form>

      <ChangePasswordForm />
    </main>
  );
}
