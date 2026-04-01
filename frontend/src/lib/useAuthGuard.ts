/**
 * useAuthGuard — хук проверки аутентификации и роли.
 * Редиректит на /login если не залогинен,
 * на /dashboard если не админ (при requireAdmin).
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, isAdmin } from "@/lib/auth";

interface AuthGuardOptions {
  requireAdmin?: boolean;
}

export function useAuthGuard(options: AuthGuardOptions = {}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    if (options.requireAdmin && !isAdmin()) {
      router.replace("/dashboard");
      return;
    }
    setAllowed(true);
    setChecked(true);
  }, [router, options.requireAdmin]);

  return { checked, allowed };
}
