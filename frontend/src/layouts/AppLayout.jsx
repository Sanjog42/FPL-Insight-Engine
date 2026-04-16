import MainLayout from "./MainLayout";

export default function AppLayout({ title, subtitle, children }) {
  return (
    <MainLayout title={title} subtitle={subtitle}>
      {children}
    </MainLayout>
  );
}
