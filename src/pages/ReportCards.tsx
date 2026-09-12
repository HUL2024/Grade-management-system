import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui';
import { effectiveApprovedGrade, roundWhole, roundOneDecimal, gradeColorClassPrint } from '../lib/periodGrades';
import { computeRanks } from '../lib/grading';
import type { SchoolClass, Student, Grade, PeriodDirectGrade, Period, Subject, SchoolSettings } from '../types';

export default function ReportCards() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [classGrades, setClassGrades] = useState<Grade[]>([]);
  const [classDirectGrades, setClassDirectGrades] = useState<PeriodDirectGrade[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('school_settings').select('*').single(),
    ]).then(([{ data: c }, { data: s }, { data: set }]) => {
      setClasses((c as SchoolClass[]) ?? []);
      setSubjects((s as Subject[]) ?? []);
      setSettings(set as SchoolSettings);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;
    Promise.all([
      supabase.from('students').select('*').eq('current_class_id', classId).eq('status', 'Active').order('last_name'),
      supabase.from('periods').select('*').eq('academic_year_id', cls.academic_year_id).order('sort_order'),
      supabase.from('grades').select('*').eq('class_id', classId),
      supabase.from('period_direct_grades').select('*').eq('class_id', classId),
    ]).then(([{ data: s }, { data: p }, { data: g }, { data: d }]) => {
      setStudents((s as Student[]) ?? []);
      setPeriods((p as Period[]) ?? []);
      setClassGrades((g as Grade[]) ?? []);
      setClassDirectGrades((d as PeriodDirectGrade[]) ?? []);
    });
  }, [classId, classes]);

  const semester1 = periods.slice(0, Math.ceil(periods.length / 2));
  const semester2 = periods.slice(Math.ceil(periods.length / 2));

  function gradeFor(forStudentId: string, subjectId: string, periodId: string): number | null {
    const scores = classGrades.filter((g) => g.student_id === forStudentId && g.subject_id === subjectId && g.period_id === periodId);
    const direct = classDirectGrades.find((d) => d.student_id === forStudentId && d.subject_id === subjectId && d.period_id === periodId);
    return effectiveApprovedGrade(scores, direct);
  }

  function buildStudentReport(forStudentId: string) {
    const rows = subjects.map((subj) => {
      const sem1Values = semester1.map((p) => gradeFor(forStudentId, subj.id, p.id));
      const sem2Values = semester2.map((p) => gradeFor(forStudentId, subj.id, p.id));
      const avg1 = roundWhole(sem1Values);
      const avg2 = roundWhole(sem2Values);
      const yearly = roundWhole([avg1, avg2]);
      return { subject: subj, sem1Values, sem2Values, avg1, avg2, yearly };
    }).filter((r) => r.sem1Values.some((v) => v !== null) || r.sem2Values.some((v) => v !== null));

    const bottomAverages = {
      sem1: semester1.map((_, i) => roundOneDecimal(rows.map((r) => r.sem1Values[i]))),
      avg1: roundOneDecimal(rows.map((r) => r.avg1)),
      sem2: semester2.map((_, i) => roundOneDecimal(rows.map((r) => r.sem2Values[i]))),
      avg2: roundOneDecimal(rows.map((r) => r.avg2)),
      yearly: roundOneDecimal(rows.map((r) => r.yearly)),
    };
    return { rows, bottomAverages };
  }

  // Rank every active student in the class by their yearly cross-subject average.
  const ranks = useMemo(() => {
    const yearlyByStudent = students.map((s) => ({ id: s.id, average: buildStudentReport(s.id).bottomAverages.yearly }));
    return computeRanks(yearlyByStudent, settings?.tie_rule ?? 'shared_rank');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, classGrades, classDirectGrades, subjects, periods, settings]);

  const student = students.find((s) => s.id === studentId);
  const cls = classes.find((c) => c.id === classId);
  const report = student ? buildStudentReport(student.id) : null;
  const rank = student ? ranks.get(student.id) ?? null : null;

  return (
    <div className="p-4">
      <div className="no-print mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gold">Report Cards</h1>
      </div>
      <div className="no-print mb-3 grid grid-cols-2 gap-2">
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(''); }} className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="rounded-lg border border-neutral-700 bg-surface px-2 py-2 text-sm">
          <option value="">Student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
        </select>
      </div>

      {!student || !report ? (
        <p className="py-10 text-center text-sm text-neutral-500">Select a class and student to view their report card.</p>
      ) : (
        <>
          <div id="report-card-print" className="rounded-xl border-2 border-gold/60 bg-white p-3 text-black">
            <div className="mb-2 border-b-2 border-blue-900 pb-2 text-center">
              <div className="text-base font-bold tracking-wide text-blue-900">{settings?.school_name ?? 'AJB LEADERS ACADEMY'}</div>
              <div className="text-[10px]">{settings?.address}</div>
              <div className="mt-1 text-[11px] font-semibold text-red-700">STUDENT PROGRESS REPORT CARD</div>
            </div>

            <div className="mb-2 grid grid-cols-3 gap-1 text-[10px]">
              <div><span className="text-neutral-500">STUDENT</span><br /><b>{student.first_name} {student.last_name}</b></div>
              <div><span className="text-neutral-500">CLASS</span><br /><b>{cls?.name}</b></div>
              <div><span className="text-neutral-500">SECTION</span><br /><b>{student.section ?? '—'}</b></div>
            </div>

            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="bg-blue-50">
                  <th rowSpan={2} className="border border-blue-200 p-1 text-left">SUBJECTS</th>
                  <th colSpan={semester1.length + 1} className="border border-blue-200 p-1">FIRST SEMESTER</th>
                  <th colSpan={semester2.length + 1} className="border border-blue-200 p-1">SECOND SEMESTER</th>
                  <th rowSpan={2} className="border border-blue-200 p-1">YEARLY<br />AVG</th>
                </tr>
                <tr className="bg-blue-50">
                  {semester1.map((p) => <th key={p.id} className="border border-blue-200 p-1 font-normal">{p.name}</th>)}
                  <th className="border border-blue-200 p-1">AVG</th>
                  {semester2.map((p) => <th key={p.id} className="border border-blue-200 p-1 font-normal">{p.name}</th>)}
                  <th className="border border-blue-200 p-1">AVG</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.subject.id}>
                    <td className="border border-blue-100 p-1 font-medium text-red-800">{r.subject.name}</td>
                    {r.sem1Values.map((v, i) => <td key={i} className={`border border-blue-100 p-1 text-center ${gradeColorClassPrint(v)}`}>{v ?? ''}</td>)}
                    <td className={`border border-blue-100 p-1 text-center font-semibold ${gradeColorClassPrint(r.avg1)}`}>{r.avg1 ?? ''}</td>
                    {r.sem2Values.map((v, i) => <td key={i} className={`border border-blue-100 p-1 text-center ${gradeColorClassPrint(v)}`}>{v ?? ''}</td>)}
                    <td className={`border border-blue-100 p-1 text-center font-semibold ${gradeColorClassPrint(r.avg2)}`}>{r.avg2 ?? ''}</td>
                    <td className={`border border-blue-100 p-1 text-center font-semibold ${gradeColorClassPrint(r.yearly)}`}>{r.yearly ?? ''}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-semibold">
                  <td className="border border-blue-200 p-1">Average</td>
                  {report.bottomAverages.sem1.map((v, i) => <td key={i} className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(v)}`}>{v ?? ''}</td>)}
                  <td className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(report.bottomAverages.avg1)}`}>{report.bottomAverages.avg1 ?? ''}</td>
                  {report.bottomAverages.sem2.map((v, i) => <td key={i} className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(v)}`}>{v ?? ''}</td>)}
                  <td className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(report.bottomAverages.avg2)}`}>{report.bottomAverages.avg2 ?? ''}</td>
                  <td className={`border border-blue-200 p-1 text-center ${gradeColorClassPrint(report.bottomAverages.yearly)}`}>{report.bottomAverages.yearly ?? ''}</td>
                </tr>
                <tr className="bg-yellow-50 font-semibold">
                  <td colSpan={semester1.length + semester2.length + 3} className="border border-blue-200 p-1 text-center">
                    Class Rank: {rank ?? '—'} of {students.length}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-6 flex justify-between text-[9px]">
              <div>____________________<br />Class Teacher's Signature</div>
              <div>____________________<br />Principal's Signature</div>
              <div>____________________<br />Date</div>
            </div>
          </div>

          <Button className="no-print mt-3 w-full" onClick={() => window.print()}>Print / Save PDF</Button>
        </>
      )}
    </div>
  );
}
