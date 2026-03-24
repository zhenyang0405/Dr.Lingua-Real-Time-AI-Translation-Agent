"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-blue-600 text-white rounded-lg w-12 h-12 flex items-center justify-center font-bold text-2xl shadow-md">
          L
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Dr. Lingua</h1>
      </div>
      <p className="text-gray-500 text-lg mb-12">AI-powered translation, beyond words</p>

      {/* Feature Cards */}
      <div className="flex flex-col sm:flex-row gap-6 max-w-3xl w-full">
        {/* Document Translation Card */}
        <Link
          href="/translate"
          className="flex-1 group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all p-8 flex flex-col items-center text-center"
        >
          <div className="bg-blue-50 group-hover:bg-blue-100 transition-colors p-5 rounded-2xl mb-5">
            <span className="text-5xl">📄</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Document Translation</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Upload research documents and get real-time AI translation with annotations.
            Supports PDFs, images, tables, and charts.
          </p>
          <div className="mt-6 text-blue-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
            Get started &rarr;
          </div>
        </Link>

        {/* Visual Noun Conversation Card */}
        <Link
          href="/conversation"
          className="flex-1 group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-purple-300 transition-all p-8 flex flex-col items-center text-center"
        >
          <div className="bg-purple-50 group-hover:bg-purple-100 transition-colors p-5 rounded-2xl mb-5">
            <span className="text-5xl">🎙️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Live Conversation</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Real-time speech translation with visual cards for culturally-specific terms.
            See what the speaker means, not just the words.
          </p>
          <div className="mt-6 text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
            Start talking &rarr;
          </div>
        </Link>
      </div>
    </main>
  );
}
