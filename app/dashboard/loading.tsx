// 📁 app/dashboard/loading.tsx — গ্লোবাল-নেভিগেশন-ফিডব্যাক: যেকোনো-মেনু/লিংক-ক্লিকে-তাৎক্ষণিক-স্কেলিটন
// বিশুদ্ধ-ভিজ্যুয়াল (টেক্সট-নেই → dict/i18n-স্পর্শ-শূন্য); শুধু-shadcn-টোকেন (নীতি ১৭)
export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="rounded-lg border border-border">
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
