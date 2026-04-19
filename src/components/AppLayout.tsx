import { Outlet, Link, useLocation } from "react-router-dom";
import { BookOpen, Search, Calendar, Home, Settings, GitBranch, GraduationCap, Moon, Sun, BarChart3, GitCompare, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ChatWidget from "@/components/ChatWidget";

const mainNav = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/catalog", icon: BookOpen, label: "Catalog" },
  { to: "/search", icon: Search, label: "Search" },
];

const academicNav = [
  { to: "/majors", icon: GraduationCap, label: "Majors" },
  { to: "/prereq-graph", icon: GitBranch, label: "Prereq Graph" },
  { to: "/planner", icon: Calendar, label: "Planner" },
  { to: "/compare", icon: GitCompare, label: "Compare" },
];

const toolsNav = [
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/admin", icon: Settings, label: "Admin" },
];

const AppLayout = () => {
  const location = useLocation();
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const renderNavSection = (items: typeof mainNav, title?: string) => (
    <>
      {title && <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-3 mt-4 mb-1">{title}</p>}
      {items.map((item) => {
        const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  const allMobileItems = [...mainNav, ...academicNav.slice(0, 2), toolsNav[0]];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-sidebar-foreground leading-tight">UNCP</h1>
              <p className="text-xs text-sidebar-accent-foreground/60">Academic Planner</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {renderNavSection(mainNav)}
          {renderNavSection(academicNav, "Academic")}
          {renderNavSection(toolsNav, "Tools")}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {dark ? "Light Mode" : "Dark Mode"}
          </Button>
          <p className="text-xs text-sidebar-foreground/40 text-center">UNCP 2025-2026 Catalog</p>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border">
        <nav className="flex justify-around py-2">
          {allMobileItems.map((item) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1.5 text-[10px]",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      <ChatWidget />
    </div>
  );
};

export default AppLayout;
