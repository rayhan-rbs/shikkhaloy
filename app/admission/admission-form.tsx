"use client";
// M14-F2: আবেদন-ফরম — শাপলা-টেমপ্লেটের-মার্কআপ; শ্রেণি→সেকশন-ফিল্টার
import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { submitAdmission, type ApplyState } from "./actions";

type Opt = { id: string; name: string };
type Sec = { id: string; name: string; classId: string };

export default function AdmissionForm({ lang, branches, classes, sections }: {
  lang: "bn" | "en"; branches: Opt[]; classes: Opt[]; sections: Sec[];
}) {
  const L = (bn: string, en: string) => (lang === "en" ? en : bn);
  const [state, action, pending] = useActionState<ApplyState, FormData>(submitAdmission, { ok: false });
  const [classId, setClassId] = useState("");
  const secs = sections.filter((s) => s.classId === classId);

  if (state.ok && state.applicationNo) {
    return (
      <div className="form-card" style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--green-100)", color: "var(--green-700)", display: "grid", placeItems: "center", margin: "0 auto 16px", fontSize: 30, fontWeight: 800 }}>✓</div>
        <h3 className="sec-title">{L("আবেদন সফল হয়েছে!", "Application submitted!")}</h3>
        <p className="sec-sub" style={{ marginInline: "auto" }}>{L("আপনার অ্যাপ্লিকেশন নম্বর — সংরক্ষণ করুন:", "Your application number — save it:")}</p>
        <div style={{ display: "inline-block", marginTop: 12, padding: "14px 30px", borderRadius: "var(--r-full)", background: "var(--green-900)", color: "var(--gold)", fontWeight: 800, fontSize: "1.4rem", letterSpacing: 1 }}>{state.applicationNo}</div>
        <p className="form-note" style={{ justifyContent: "center" }}>{L("ভর্তি টিম ২৪ ঘণ্টার মধ্যে ফোন করে পরবর্তী ধাপ জানাবে।", "Our admission team will call you within 24 hours.")}</p>
      </div>
    );
  }

  return (
    <form action={action} className="form-card">
      {state.error && (
        <p className="rs-demo" style={{ marginTop: 0, gridColumn: "1/-1" }}>
          ⚠ {L("সব * চিহ্নিত ঘর ঠিকভাবে পূরণ করে আবার চেষ্টা করুন।", "Fill all * fields correctly and try again.")}
        </p>
      )}
      <div className="form-grid">
        <div className="field">
          <label>{L("শাখা", "Branch")} <em>*</em></label>
          <select name="branchId" required defaultValue="">
            <option value="" disabled>{L("— শাখা নির্বাচন করুন —", "— Choose branch —")}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{L("শ্রেণি", "Class")} <em>*</em></label>
          <select name="classId" required value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="" disabled>{L("— শ্রেণি নির্বাচন করুন —", "— Choose class —")}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{L("সেকশন", "Section")}</label>
          <select name="sectionId" defaultValue="">
            <option value="">{L("— পরে নির্ধারণ হবে —", "— To be assigned —")}</option>
            {secs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{L("শিক্ষার্থীর পূর্ণ নাম", "Student full name")} <em>*</em></label>
          <input name="fullName" type="text" required placeholder={L("যেমন: মোঃ রাকিবুল হাসান", "e.g. Rakibul Hasan")} />
        </div>
        <div className="field">
          <label>{L("ইমেইল", "Email")} <em>*</em></label>
          <input name="email" type="email" required placeholder="you@example.com" />
        </div>
        <div className="field">
          <label>{L("মোবাইল নম্বর", "Mobile")} <em>*</em></label>
          <input name="phone" type="tel" required placeholder="01XXXXXXXXX" />
        </div>
        <div className="field">
          <label>{L("জন্ম তারিখ", "Date of birth")}</label>
          <input name="dateOfBirth" type="date" />
        </div>
        <div className="field">
          <label>{L("লিঙ্গ", "Gender")}</label>
          <select name="gender" defaultValue="">
            <option value="">{L("— নির্বাচন করুন —", "— Select —")}</option>
            <option value="MALE">{L("ছেলে", "Male")}</option>
            <option value="FEMALE">{L("মেয়ে", "Female")}</option>
            <option value="OTHER">{L("অন্যান্য", "Other")}</option>
          </select>
        </div>
        <div className="field">
          <label>{L("পিতার নাম", "Father's name")}</label>
          <input name="fatherName" type="text" />
        </div>
        <div className="field">
          <label>{L("মাতার নাম", "Mother's name")}</label>
          <input name="motherName" type="text" />
        </div>
        <div className="field">
          <label>{L("অভিভাবকের মোবাইল", "Guardian's mobile")}</label>
          <input name="guardianPhone" type="tel" placeholder="01XXXXXXXXX" />
        </div>
        <div className="field">
          <label>{L("পূর্ববর্তী প্রতিষ্ঠান", "Previous institution")}</label>
          <input name="previousInstitution" type="text" />
        </div>
        <div className="field field--full">
          <label>{L("ঠিকানা", "Address")}</label>
          <textarea name="address" placeholder={L("বর্তমান ঠিকানা লিখুন...", "Current address...")} />
        </div>
        <div className="form-foot">
          <p className="form-note" style={{ margin: 0 }}>
            {L("আপনার তথ্য সুরক্ষিত — শুধু ভর্তি কার্যক্রমে ব্যবহৃত হবে।", "Your data is safe — used only for admission.")}
          </p>
          <button type="submit" className="btn btn--primary btn--lg" disabled={pending}>
            <Send size={18} />{pending ? L("পাঠানো হচ্ছে...", "Sending...") : L("আবেদন জমা দিন", "Submit application")}
          </button>
        </div>
      </div>
    </form>
  );
}
