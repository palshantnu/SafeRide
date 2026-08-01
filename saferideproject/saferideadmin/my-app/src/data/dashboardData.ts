import { IndianRupee, ShoppingCart, UserCheck, Zap } from "lucide-react";

export const revenueData = [
  { month: "Jan", revenue: 32000 }, { month: "Feb", revenue: 45000 },
  { month: "Mar", revenue: 38000 }, { month: "Apr", revenue: 52000 },
  { month: "May", revenue: 61000 }, { month: "Jun", revenue: 48000 },
  { month: "Jul", revenue: 70000 }, { month: "Aug", revenue: 65000 },
  { month: "Sep", revenue: 78000 }, { month: "Oct", revenue: 82000 },
  { month: "Nov", revenue: 91000 }, { month: "Dec", revenue: 105000 },
];

export const statsData = [
  { label: "Total Revenue", value: "₹8,24,500", change: "+18.2%", up: true, icon: IndianRupee, accent: "#3b82f6", bg: "#eff6ff" },
  { label: "Total Orders", value: "3,420", change: "+12.5%", up: true, icon: ShoppingCart, accent: "#8b5cf6", bg: "#f5f3ff" },
  { label: "Customers", value: "1,280", change: "+8.1%", up: true, icon: UserCheck, accent: "#10b981", bg: "#ecfdf5" },
  { label: "Avg Order Value", value: "₹2,410", change: "-2.3%", up: false, icon: Zap, accent: "#f59e0b", bg: "#fffbeb" },
];