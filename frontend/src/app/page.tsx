import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("@/components/HomePage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#06000f] flex items-center justify-center">
      <div className="text-purple-400 text-lg">Загрузка…</div>
    </div>
  ),
});

export default function Page() {
  return <HomePage />;
}
