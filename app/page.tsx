import { Suspense } from "react";
import { AuthScreen } from "@/app/auth-screen";
import { getSessionUser } from "@/lib/session";

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center bg-[#eef3f7] text-sm text-slate-500">
      جارٍ التحميل...
    </div>
  );
}

async function HomeContent() {
  const username = await getSessionUser();
  return <AuthScreen key={username ?? "guest"} initialUsername={username} />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <HomeContent />
    </Suspense>
  );
}

