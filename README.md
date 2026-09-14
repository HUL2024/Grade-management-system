# AJB Leaders Academy — Grade Management System

A comprehensive, offline-capable Android grade and academic records management
system for **AJB Leaders Academy** (Diamond Creek, Soul Clinic Community,
Paynesville City, Liberia), covering students, teachers, classes, subjects,
gradebook, attendance, report cards, rankings, academic history, promotion,
reports, backup/restore, user roles, and an activity log.

Built with **React + TypeScript + Vite + Tailwind CSS**, packaged as a native
Android app with **Capacitor**, backed by **Supabase** (Postgres + Auth).

Version: **v1.0.0**

---

## 1. Project status (what's built)

This is the Phase 1-5 foundation of the full spec:

- Login & role-based access (Administrator, Principal, Teacher, Academic
  Officer, Viewer)
- Dashboard with live stats
- Students, Teachers, Classes, Subjects — full CRUD, search & filters
- Academic Years & Periods management
- Gradebook — fast grade entry, validation, missing/absent/excused/exempt
  statuses, submit-for-review workflow
- Attendance marking (Present/Absent/Late/Excused)
- Rankings (class ranking with configurable tie handling)
- Report Cards (view + print/PDF via browser print)
- Academic History (permanent per-student snapshots)
- Promotion workflow (bulk, with review screen, preserves history)
- Reports Center (missing/submitted/locked grades, class performance)
- Settings (school info, assessment weights, grading scale, tie rules)
- Backup & Restore (JSON export/import with confirmation)
- User Management (role assignment)
- Activity Log (audit trail)
- Offline indicator, saving/loading status indicators throughout
- GitHub Actions workflow that builds a real, installable Android APK

Not yet built (flagged honestly, not faked): grade locking/unlocking UI by an
administrator after submission, CSV/Excel import-export, push notifications,
a subject/teacher assignment matrix UI, and student photo upload. These are
straightforward to add on top of this foundation — ask and they can be built
next.

---

## 2. Set up Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase SQL Editor, run the entire contents of
   `supabase/schema.sql` from this repo. This creates every table, the
   row-level-security policies, the default grading scale, and seed subjects
   and assessment types.
3. Go to **Authentication -> Users** and create your first staff accounts
   (e.g. the Principal, an Administrator). Use their real email addresses.
4. For each account you create, go to **Table Editor -> profiles** and insert
   a row with the same `id` as the auth user, their `full_name`, and a
   `role` of `administrator`, `principal`, `teacher`, `academic_officer`, or
   `viewer`. (Once you have one administrator logged in, the in-app **User
   Management** screen can manage roles for everyone else.)
5. Copy your project's **Project URL** and **anon public key** from
   **Settings -> API** — you'll need them next.
6. **Deploy the "create-staff-account" Edge Function** — this is what lets
   an administrator create a teacher's login (phone number + password) from
   inside the app. It needs the Supabase CLI:

   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref your-project-ref
   supabase functions deploy create-staff-account
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   The service role key is on **Settings -> API -> service_role** — never
   put this key in the app itself; it only ever lives in this server-side
   function.

   If you already ran `schema.sql` before this update, also run
   `supabase/add_teacher_login_index.sql` once in the SQL Editor.

## 3. Local development

```bash
npm install
cp .env.example .env
# edit .env and paste your Supabase URL + anon key
npm run dev
```

## 4. Building the Android APK

### Automatically (recommended) — GitHub Actions

1. Push this repository to GitHub.
2. In your repo, go to **Settings -> Secrets and variables -> Actions** and
   add two repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Go to the **Actions** tab and either push to `main` or run
   **Build APK -> Run workflow** manually.
4. When it finishes, open the workflow run and download the
   `AJB-Leaders-Academy-Grade-Management-System` artifact — it contains
   `app-debug.apk`.
5. Transfer the APK to an Android device (or install directly) to run it.
   You may need to allow "Install unknown apps" for the source you use.

### Manually (if you have Android Studio / the Android SDK installed)

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# APK will be at android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 5. Project structure

```
├── src/
│   ├── components/       # Layout, route guard, shared UI primitives
│   ├── context/          # AuthContext (session, role, online/offline)
│   ├── lib/               # Supabase client, activity log, grading helpers
│   ├── pages/             # One file per navigation section
│   ├── types/             # TypeScript types matching the DB schema
│   └── App.tsx            # Route table + role-gated routes
├── supabase/
│   └── schema.sql         # Full DB schema, RLS policies, seed data
├── android/                # Capacitor-generated native Android project
├── .github/workflows/
│   └── build-apk.yml       # CI: builds + uploads the APK
└── capacitor.config.ts
```

## 6. Data & offline behavior

The app is a Supabase-backed client. Normal Android WebView caching keeps the
UI usable when connectivity briefly drops, and the top bar shows an
**Online/Offline** indicator. Writes made while offline are not yet queued
for later sync — that queueing layer is a natural next phase (Capacitor's
Preferences/SQLite plugin) if fully offline data entry becomes a priority.

## 7. Roles

| Role | Access |
|---|---|
| Administrator | Full system access |
| Principal / School Head | Academic records, reports, students, grades, dashboards |
| Teacher | Assigned classes/subjects gradebook & attendance |
| Academic Officer | Grades, academic records, rankings, reports |
| Viewer | Read-only |

Administrators and Principals log in with a real email address. Teachers log
in with their phone number and a password set by the administrator when
their account is created (see **Teachers -> Add**) — internally this uses a
hidden email derived from their phone number, but they never see or need it.

Row-level security is enforced in Postgres itself (see `supabase/schema.sql`),
not just hidden in the UI, so permissions hold even against direct API calls.

## 8. Backup & restore

**Settings -> Backup & Restore** exports all core tables to a single JSON
file, and can restore from one. Restoring always asks for confirmation
first and upserts (never silently deletes) existing rows.

## 9. Student & teacher photos

Both forms have an **Add Photo** button. Photos are automatically resized and
re-compressed in the browser to under 50KB before upload, so there's nothing
to configure — just pick any photo and it's handled.

If you already ran `schema.sql` before this update, run
`supabase/add_photo_storage.sql` once in the SQL Editor to add the photo
storage bucket and the `teachers.photo_url` column.

## 10. How grade entry works (Way 1 vs Way 2)

Each student's grade for a subject in a period can be entered one of two ways:

- **Way 1 — Detailed assessments**: individual scores (Class Participation,
  Homework 1, Homework 2, Quiz 1, Quiz 2, Test, etc.) are entered per student
  and summed into the period total.
- **Way 2 — Direct final grade**: the teacher types the finished period grade
  straight in, no breakdown.

Rules (enforced in both the Gradebook UI and the database):

- If detailed scores already exist for a student/subject/period, a direct
  grade **cannot** be entered — it's rejected with an explanation.
- If a direct grade already exists and the teacher then starts entering
  detailed scores, the detailed scores **win** — the direct grade is
  automatically cleared.
- Both ways are bounded: a period's final grade can never be saved below 65
  or above 100. Entries that would push the total outside that range are
  rejected before saving.

If you already ran `schema.sql` before this update, run
`supabase/add_period_direct_grades.sql` once in the SQL Editor.

## 11. Report card averaging rules

- **1st/2nd/3rd Period + Exam → First Semester Average** (whole number,
  rounded — no decimals).
- **4th/5th/6th Period + Exam → Second Semester Average** (whole number).
- **Yearly Average** = average of the two semester averages (whole number).
- The **bottom "Average" row** is a *cross-subject* average — for each
  column (each period, both semester averages, and the yearly average),
  it averages that column down every subject row. This one is rounded to
  **one decimal place**.
- **Class rank** is calculated from that bottom row's Yearly Average value
  across the whole class, with ties handled per the tie rule in Settings.

## 12. Printing

Report Cards print cleanly — the app's navigation, selectors, and the
Print button itself are hidden automatically in print/PDF output, leaving
only the report card.

## 13. Grade approval workflow

- A teacher enters grades (Draft) and clicks **Submit for Review**, which
  locks those cells — they can't be edited again until an administrator or
  principal acts on them.
- Administrators/Principals see extra buttons on the same Gradebook screen:
  **Approve Submitted** (grades become visible on report cards and
  rankings) and **Send Back to Draft** (unlocks them for the teacher to
  fix and resubmit). Administrators/Principals can also edit locked cells
  directly if needed.
- Report Cards and Rankings only ever show **approved** grades — anything
  still in Draft or Pending never appears there.
- Every button shows a clear "…ing" state while working and a plain-language
  result message afterward (e.g. "Approved 8 grade(s)").

If you already ran `supabase/add_period_direct_grades.sql` before this
update, also run `supabase/add_grade_approval_status.sql` once.

## 14. Clearer error messages

Actions that fail (duplicate Student ID, duplicate Teacher ID, etc.) now
show a specific, plain-language reason instead of a generic "Save failed."

## 15. Teacher access is now scoped — IMPORTANT SETUP STEP

Teachers can now only see and grade the classes/subjects they are actually
assigned to — enforced at the database level (Row Level Security), not just
hidden in the UI. This is controlled entirely by the new **Teacher
Assignments** screen (Administrator/Principal only).

**Without an assignment, a teacher sees nothing** — no classes, no
students, no subjects, empty Gradebook. So right after running the
migration below, go to **Teacher Assignments** and assign every teacher to
every class + subject combination they actually teach (e.g. Mary → Grade 1
→ Math). A teacher with Math for Grades 5, 6, and 7 needs three separate
assignment rows.

Run once in the SQL Editor if you already ran earlier migrations:
```
supabase/add_teacher_scoping.sql
```
This also adds optional start/end dates to periods (for attendance
reporting) and the `student_conduct` table.

## 16. Grade approval — per-student control

Administrators/Principals can now approve or send back **one student at a
time** right in the Gradebook (an Approve/Unlock button per row), as well
as in bulk for the whole class. Either way, a grade can never be approved
below 65 — it's silently skipped with an explanation if someone tries.

A submitted grade no longer locks immediately — it stays editable by the
teacher until an administrator/principal actually **approves** it. That's
the point it becomes locked and visible on report cards/rankings.

## 17. Report card — restored sections + per-period ranking

- **Grading Method** key, **Promotion Statement** (with the four outcome
  checkboxes), and **Motto** are back on the printed card.
- **Rank** is now its own row with one rank per column — every period, both
  semester averages, and the yearly average each get their own class rank,
  not just one overall rank.
- **Conduct** is a manually-typed field (Administrator/Principal/Teacher),
  saved once per student per academic year, shown as its own row.
- **Attendance %** is its own row, computed automatically from real
  attendance records — but only for periods that have a start/end date set
  (Academic Years → edit a period). Periods without dates show "—".

## 18. Report card PDF on Android

Android's WebView (what the APK runs on) has no support for `window.print()`
at all — that's exactly why the old "Print" button worked in a normal
browser at `localhost:5173` but did nothing on the phone. Report Cards now
use a real PDF generator instead:

- **On Android**: the PDF is written to the app's cache and handed to the
  native Share sheet — the person can save it, send it via WhatsApp, etc.
- **On the web**: it downloads normally, same as before.

This needed two new Capacitor plugins (`@capacitor/filesystem`,
`@capacitor/share`) — already wired into `android/`. If you ever add a
Capacitor plugin yourself, remember to run `npx cap sync android`
afterward so the native project picks it up (already done here).

## 19. GitHub Actions build environment

The workflow now pins **Node 22** and **JDK 21** — the versions confirmed to
work with this Capacitor Android project — instead of Node 20 / JDK 17.
No manual edits should be needed to `build-apk.yml` going forward.

## 20. Adding teachers to classes/subjects

You can now do this in the same place you create a teacher: open
**Teachers → Add** (or edit an existing teacher), and once the account
exists a "Classes & Subjects Assigned" section appears right in that form
— no need to jump to a separate screen or the Supabase backend. The
standalone **Teacher Assignments** screen still exists too, useful for
seeing everyone's assignments at once.

Removing an assignment only changes who is *currently* responsible for
that class/subject going forward — it never touches or reassigns grades a
previous teacher already entered. Those stay exactly as recorded.

## 21. Report card download restricted to Administrators/Principals

Teachers can view any report card they have access to, but the
Download/Share PDF button only appears for Administrators and Principals.
Teachers instead see a note explaining that.

## 22. My Profile (read-only)

Everyone has a **My Profile** page now. Teachers see their own teacher
record (ID, phone, qualification, etc.) but can't edit any of it from
there — only an administrator can change it, via the Teachers screen.

## 23. Notifications

A bell icon in the top bar shows real, unread notifications:
- Administrators/Principals are notified when a teacher submits grades for
  review.
- Teachers are notified when their submitted grade is **approved**, or
  **sent back as draft** (so they know to fix and resubmit).

Run `supabase/add_notifications.sql` once if you already ran schema.sql
before this update.

## 24. Report card PDF color bug fixed

Downloading previously failed with "unsupported color function oklab" —
that came from Tailwind's newer color palette, which html2canvas (the
library building the PDF) can't parse. Every color inside the printed
report card now uses plain hex values instead, so PDF export is reliable.
The report card layout was also reordered: Grading Method (left),
Promotion Statement (middle, with the student's name and grade
underlined), Motto (right).

## 25. Attendance is now period-first, and the report card shows real fractions

Taking attendance now asks for **Academic Year → Period → Class → Date**,
in that order — matching the Gradebook's flow. Each attendance record is
tagged with the period it belongs to.

The report card's Attendance row now shows a plain fraction, e.g. **7/10**
— 7 days present out of 10 total tracked days. The total only counts
Present + Absent + Excused (Late is recorded but not counted in the
total, per your spec). Semester/Yearly columns sum the fractions across
their periods rather than averaging percentages.

Run `supabase/add_attendance_period_and_notify_fix.sql` once if you
already ran earlier migrations — it adds the `period_id` column to
attendance and fixes the admin-notification bug below.

## 26. Notification bug fix — admins weren't getting notified

The `profiles` table is intentionally locked so a person can only read
their own row (protects everyone's role/contact info from each other). That
meant when a teacher submitted grades, their session had no way to look up
"who are the administrators" — so the notification silently went nowhere.
Fixed with a narrow database function that safely returns just the
administrator/principal user ids, without opening up the profiles table
itself. Notifications also now **disappear once read** instead of sitting
around grayed out — the bell only ever shows what's still unread.

## 27. Pull-to-refresh

Pulling down from the top of any screen reloads the app — same gesture
people already expect from other mobile apps.

## 28. Auto-logout after 30 minutes

Every account — Administrator, Principal, Teacher, everyone — is signed
out automatically after 30 minutes with no activity (no taps, scrolling,
or typing). Any interaction resets the clock.

## 29. Report card download, restricted + bulk

- Only Administrators/Principals see a download button at all; teachers
  can view a report card but not download it.
- **Download All (N students) for [Class]** builds one combined PDF with
  every active student's report card as its own page — for printing a
  whole class at once. This can take a little while for large classes
  since it renders each student's card in turn.

## 30. PDF export no longer crops content

The old single-page-shrink approach could make content look cut off if it
was tall (e.g. the promotion statement checkboxes at the bottom). Report
cards now paginate properly — if content is too long for one sheet, it
continues onto a second page instead of being cropped or squeezed
unreadably small.

## 31. Notification bug fixed (root cause found)

Postgres functions that `return setof uuid` come back from Supabase as
`[{"get_approver_user_ids": "..."}]`, not a plain array of strings — the
earlier code assumed the latter, so every admin notification was silently
being built with an invalid `user_id` and failing to insert. Fixed by
giving the function a named return column, so the shape is unambiguous,
and by wrapping every notification call in its own error handling so a
notification failure can never block the actual grade action again.

**Run `supabase/add_attendance_period_and_notify_fix.sql` again** — even
if you ran it before, it safely re-creates the corrected function.

## 32. Camera support for photos

Students and Teachers now have two buttons — **Camera** and **Gallery** —
using Capacitor's native camera plugin instead of a plain file picker.
Camera opens the device camera directly; Gallery opens the photo library.
Both still get compressed to under 50KB automatically.

## 33. App icon — "AJB"

The Android launcher icon (and splash screen) is now a gold "AJB" wordmark
in a circle on black, matching the school's branding — generated at every
required size/density, including the adaptive icon Android 8+ uses. Source
files are in `assets/` (`icon.png`, `icon-foreground.png`,
`icon-background.png`, `splash.png`) if you ever want to regenerate them
with `npx capacitor-assets generate --android` after editing those files.
