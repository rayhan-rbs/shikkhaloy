"use server";
// M14-F1: ভর্তি-আবেদন server-action → AdmissionApplication
import { prisma } from "@/lib/prisma";

export type ApplyState = { ok: boolean; applicationNo?: string; error?: string };

export async function submitAdmission(_prev: ApplyState, fd: FormData): Promise<ApplyState> {
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const branchId = g("branchId"), classId = g("classId");
  const fullName = g("fullName"), email = g("email"), phone = g("phone");
  if (!branchId || !classId || !fullName || !email || !phone) return { ok: false, error: "required" };

  const applicationNo = `ADM-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const dob = g("dateOfBirth");
  try {
    await prisma.admissionApplication.create({
      data: {
        applicationNo, branchId, classId,
        sectionId: g("sectionId") || null,
        fullName, email, phone,
        dateOfBirth: dob ? new Date(dob) : null,
        gender: g("gender") || null,
        fatherName: g("fatherName") || null,
        motherName: g("motherName") || null,
        guardianPhone: g("guardianPhone") || null,
        address: g("address") || null,
        previousInstitution: g("previousInstitution") || null,
      },
    });
    return { ok: true, applicationNo };
  } catch {
    return { ok: false, error: "db" };
  }
}
