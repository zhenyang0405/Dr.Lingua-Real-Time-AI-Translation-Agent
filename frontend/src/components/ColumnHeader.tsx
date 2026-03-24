"use client";

import React from "react";

interface ColumnHeaderProps {
  badge: string;
  badgeColor: "en" | "jp";
  title: string;
}

export default function ColumnHeader({ badge, badgeColor, title }: ColumnHeaderProps) {
  const bgColor = badgeColor === "en" ? "bg-[#E1F5EE] text-[#0F6E56]" : "bg-[#FAECE7] text-[#993C1D]";

  return (
    <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-200 shrink-0">
      {badge && (
        <span className={`text-[16px] font-medium px-2 py-0.5 rounded-full ${bgColor}`}>
          {badge}
        </span>
      )}
      <span className="text-[18px] font-medium text-gray-500">{title}</span>
    </div>
  );
}
