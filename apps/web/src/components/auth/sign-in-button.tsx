"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { loginUrl } from "@/lib/return-url";

export function SignInButton() {
  const pathname = usePathname();
  return (
    <Button render={<Link href={loginUrl(pathname)} />} variant="ghost">
      Sign in
    </Button>
  );
}
