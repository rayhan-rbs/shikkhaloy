"use client";
// M14-E0-fixed: যোগাযোগ-ফরম (mailto)
import type { FormEvent } from "react";
import { Mail } from "lucide-react";

export default function ContactForm({ email, lang }: { email: string; lang: "bn" | "en" }) {
  const L = (bn: string, en: string) => (lang === "en" ? en : bn);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const subject = `[Website] ${fd.get("subject") || "Contact"}`;
    const body = `${L("নাম", "Name")}: ${fd.get("name")}\n${L("ফোন", "Phone")}: ${fd.get("phone") || "-"}\n${L("ইমেইল", "Email")}: ${fd.get("email") || "-"}\n\n${fd.get("message")}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="field">
          <label>{L("পূর্ণ নাম", "Full name")} <em>*</em></label>
          <input name="name" type="text" required placeholder={L("আপনার নাম", "Your name")} />
        </div>
        <div className="field">
          <label>{L("মোবাইল নম্বর", "Mobile")}</label>
          <input name="phone" type="tel" placeholder="01XXXXXXXXX" />
        </div>
        <div className="field">
          <label>{L("ইমেইল", "Email")}</label>
          <input name="email" type="email" placeholder="you@example.com" />
        </div>
        <div className="field">
          <label>{L("বিষয়", "Subject")} <em>*</em></label>
          <select name="subject" required defaultValue="">
            <option value="" disabled>{L("— বিষয় নির্বাচন করুন —", "— Choose a subject —")}</option>
            <option>{L("ভর্তি সংক্রান্ত", "Admission")}</option>
            <option>{L("ফি ও বৃত্তি", "Fees & scholarship")}</option>
            <option>{L("একাডেমিক প্রশ্ন", "Academic question")}</option>
            <option>{L("ফলাফল ও সনদ", "Results & certificate")}</option>
            <option>{L("অন্যান্য", "Other")}</option>
          </select>
        </div>
        <div className="field field--full">
          <label>{L("বার্তা", "Message")} <em>*</em></label>
          <textarea name="message" required placeholder={L("আপনার প্রশ্ন বিস্তারিত লিখুন...", "Write your question in detail...")} />
        </div>
        <div className="form-foot">
          <p className="form-note" style={{ margin: 0 }}>{L("সাধারণত ১ কর্মদিবসের মধ্যে উত্তর দেওয়া হয়।", "We usually reply within one working day.")}</p>
          <button type="submit" className="btn btn--primary btn--lg"><Mail size={18} />{L("বার্তা পাঠান", "Send message")}</button>
        </div>
      </div>
    </form>
  );
}
