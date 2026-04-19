import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Index from "./pages/Index";
import Catalog from "./pages/Catalog";
import Search from "./pages/Search";
import CourseDetail from "./pages/CourseDetail";
import PrereqGraph from "./pages/PrereqGraph";
import Planner from "./pages/Planner";
import Majors from "./pages/Majors";
import Admin from "./pages/Admin";
import Analytics from "./pages/Analytics";
import Compare from "./pages/Compare";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/search" element={<Search />} />
            <Route path="/course/:id" element={<CourseDetail />} />
            <Route path="/prereq-graph" element={<PrereqGraph />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/majors" element={<Majors />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/compare" element={<Compare />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
