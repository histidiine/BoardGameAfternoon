import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getViewer()) redirect("/profile");
  const { error } = await searchParams;
  return <LoginForm linkError={error === "link"} />;
}
