"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  Folder,
  Building2,
  LayoutGrid,
  Network,
  Settings,
  Store,
  Tags,
} from "lucide-react";

import { useAuth } from "@/auth/clerk";
import { ApiError } from "@/api/mutator";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import {
  type healthzHealthzGetResponse,
  useHealthzHealthzGet,
} from "@/api/generated/default/default";
import { cn } from "@/lib/utils";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const { isAdmin } = useOrganizationMembership(isSignedIn);
  const healthQuery = useHealthzHealthzGet<healthzHealthzGetResponse, ApiError>(
    {
      query: {
        refetchInterval: 30_000,
        refetchOnMount: "always",
        retry: false,
      },
      request: { cache: "no-store" },
    },
  );

  const okValue = healthQuery.data?.data?.ok;
  const systemStatus: "unknown" | "operational" | "degraded" =
    okValue === true
      ? "operational"
      : okValue === false
        ? "degraded"
        : healthQuery.isError
          ? "degraded"
          : "unknown";
  const statusLabel =
    systemStatus === "operational"
      ? "All systems operational"
      : systemStatus === "unknown"
        ? "System status unavailable"
        : "System degraded";

  // Active link: Forest background with Lime accent text
  const activeClass =
    "font-medium text-[#CDF765]";
  const activeStyle = { background: "#2B4A44" };
  const inactiveClass = "hover:bg-[#eef2f0] text-[#233136]";

  const navLink = (href: string, exact = false) => {
    const isActive = exact ? pathname === href : pathname.startsWith(href);
    return cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 transition",
      isActive ? activeClass : inactiveClass,
    );
  };

  return (
    /* w-64 on normal screens; 3xl (≥2048px) → w-[300px] for ultrawide */
    <aside className="flex h-full w-64 3xl:w-[300px] flex-col border-r border-[#d8e4dc] bg-white">
      <div className="flex-1 px-3 py-4">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-[#4a6060]">
          Navigation
        </p>
        <nav className="mt-3 space-y-4 text-sm">
          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#7a9898]">
              Overview
            </p>
            <div className="mt-1 space-y-1">
              <Link
                href="/dashboard"
                className={navLink("/dashboard", true)}
                style={pathname === "/dashboard" ? activeStyle : undefined}
              >
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/activity"
                className={navLink("/activity")}
                style={pathname.startsWith("/activity") ? activeStyle : undefined}
              >
                <Activity className="h-4 w-4" />
                Live feed
              </Link>
            </div>
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#7a9898]">
              Boards
            </p>
            <div className="mt-1 space-y-1">
              <Link
                href="/board-groups"
                className={navLink("/board-groups")}
                style={pathname.startsWith("/board-groups") ? activeStyle : undefined}
              >
                <Folder className="h-4 w-4" />
                Board groups
              </Link>
              <Link
                href="/boards"
                className={navLink("/boards")}
                style={pathname.startsWith("/boards") ? activeStyle : undefined}
              >
                <LayoutGrid className="h-4 w-4" />
                Boards
              </Link>
              <Link
                href="/tags"
                className={navLink("/tags")}
                style={pathname.startsWith("/tags") ? activeStyle : undefined}
              >
                <Tags className="h-4 w-4" />
                Tags
              </Link>
              <Link
                href="/approvals"
                className={navLink("/approvals")}
                style={pathname.startsWith("/approvals") ? activeStyle : undefined}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approvals
              </Link>
              {isAdmin ? (
                <Link
                  href="/custom-fields"
                  className={navLink("/custom-fields")}
                  style={pathname.startsWith("/custom-fields") ? activeStyle : undefined}
                >
                  <Settings className="h-4 w-4" />
                  Custom fields
                </Link>
              ) : null}
            </div>
          </div>

          <div>
            {isAdmin ? (
              <>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#7a9898]">
                  Skills
                </p>
                <div className="mt-1 space-y-1">
                  <Link
                    href="/skills/marketplace"
                    className={navLink("/skills/marketplace")}
                    style={
                      pathname === "/skills" ||
                      pathname.startsWith("/skills/marketplace")
                        ? activeStyle
                        : undefined
                    }
                  >
                    <Store className="h-4 w-4" />
                    Marketplace
                  </Link>
                  <Link
                    href="/skills/packs"
                    className={navLink("/skills/packs")}
                    style={pathname.startsWith("/skills/packs") ? activeStyle : undefined}
                  >
                    <Boxes className="h-4 w-4" />
                    Packs
                  </Link>
                </div>
              </>
            ) : null}
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#7a9898]">
              Administration
            </p>
            <div className="mt-1 space-y-1">
              <Link
                href="/organization"
                className={navLink("/organization")}
                style={pathname.startsWith("/organization") ? activeStyle : undefined}
              >
                <Building2 className="h-4 w-4" />
                Organization
              </Link>
              {isAdmin ? (
                <Link
                  href="/gateways"
                  className={navLink("/gateways")}
                  style={pathname.startsWith("/gateways") ? activeStyle : undefined}
                >
                  <Network className="h-4 w-4" />
                  Gateways
                </Link>
              ) : null}
              {isAdmin ? (
                <Link
                  href="/agents"
                  className={navLink("/agents")}
                  style={pathname.startsWith("/agents") ? activeStyle : undefined}
                >
                  <Bot className="h-4 w-4" />
                  Agents
                </Link>
              ) : null}
            </div>
          </div>
        </nav>
      </div>
      <div className="border-t border-[#d8e4dc] p-4">
        <div className="flex items-center gap-2 text-xs text-[#4a6060]">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              systemStatus === "operational" && "bg-emerald-500",
              systemStatus === "degraded" && "bg-rose-500",
              systemStatus === "unknown" && "bg-slate-300",
            )}
          />
          {statusLabel}
        </div>
      </div>
    </aside>
  );
}
