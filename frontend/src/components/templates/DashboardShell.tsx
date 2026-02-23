"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { SignedIn, useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import {
  type getMeApiV1UsersMeGetResponse,
  useGetMeApiV1UsersMeGet,
} from "@/api/generated/users/users";
import { BrandMark } from "@/components/atoms/BrandMark";
import { OrgSwitcher } from "@/components/organisms/OrgSwitcher";
import { UserMenu } from "@/components/organisms/UserMenu";
import { isOnboardingComplete } from "@/lib/onboarding";

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const isOnboardingPath = pathname === "/onboarding";

  const meQuery = useGetMeApiV1UsersMeGet<
    getMeApiV1UsersMeGetResponse,
    ApiError
  >({
    query: {
      enabled: Boolean(isSignedIn) && !isOnboardingPath,
      retry: false,
      refetchOnMount: "always",
    },
  });
  const profile = meQuery.data?.status === 200 ? meQuery.data.data : null;
  const displayName = profile?.name ?? profile?.preferred_name ?? "Operator";
  const displayEmail = profile?.email ?? "";

  useEffect(() => {
    if (!isSignedIn || isOnboardingPath) return;
    if (!profile) return;
    if (!isOnboardingComplete(profile)) {
      router.replace("/onboarding");
    }
  }, [isOnboardingPath, isSignedIn, profile, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "openclaw_org_switch" || !event.newValue) return;
      window.location.reload();
    };

    window.addEventListener("storage", handleStorage);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("org-switch");
      channel.onmessage = () => {
        window.location.reload();
      };
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-app text-strong">
      {/* Header — FlowPilot Mountain brand bar */}
      <header
        className="sticky top-0 z-40 border-b shadow-sm"
        style={{ background: "#233136", borderColor: "#1a2830" }}
      >
        {/*
          Grid: sidebar-width column | flex org switcher | user controls
          Normal: 260px sidebar → 3xl (≥2048px ultrawide): 300px sidebar
        */}
        <div className="grid grid-cols-[260px_1fr_auto] 3xl:grid-cols-[300px_1fr_auto] items-center gap-0 py-3">
          <div className="flex items-center px-6">
            <BrandMark />
          </div>
          <SignedIn>
            <div className="flex items-center">
              <div className="max-w-[220px]">
                <OrgSwitcher />
              </div>
            </div>
          </SignedIn>
          <SignedIn>
            <div className="flex items-center gap-3 px-6">
              <div className="hidden text-right lg:block">
                <p className="text-sm font-semibold" style={{ color: "#CDF765" }}>
                  {displayName}
                </p>
                <p className="text-xs" style={{ color: "#C7DCCD" }}>
                  Operator
                </p>
              </div>
              <UserMenu displayName={displayName} displayEmail={displayEmail} />
            </div>
          </SignedIn>
        </div>
      </header>

      {/*
        Main layout:
        - Normal:    sidebar 260px + content
        - Ultrawide (3xl ≥2048px): sidebar 300px + content
      */}
      <div
        className="grid min-h-[calc(100vh-64px)] grid-cols-[260px_1fr] 3xl:grid-cols-[300px_1fr]"
        style={{ background: "#f5f7f6" }}
      >
        {children}
      </div>
    </div>
  );
}
