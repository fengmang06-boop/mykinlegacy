import Link from "next/link";

export default function AdminHomePage() {
  return (
    <section>
      <h1>AI Heritage Admin</h1>
      <p className="notice">Admin operations MVP is running.</p>
      <Link className="button" href="/admin/dashboard">Open Dashboard</Link>
    </section>
  );
}
