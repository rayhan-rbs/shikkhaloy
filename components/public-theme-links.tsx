"use client";
// M14-S1: থিম-CSS শুধু-পাবলিক-রুটে-লাইভ (React 19 link-hoisting; unmount-এ-খুলে-যায়)
export default function PublicThemeLinks() {
  return (
    <>
      <link rel="stylesheet" href="/shapla/style.css" />
      <link rel="stylesheet" href="/shapla/pages.css" />
    </>
  );
}
