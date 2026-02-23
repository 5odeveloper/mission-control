'use client';

import { Header } from '@/components/Header';
import { OfficeView } from '@/components/OfficeView';

export default function OfficePage() {
  return (
    <div className="h-screen flex flex-col bg-mc-bg overflow-hidden">
      <Header />
      <div className="flex-1 relative overflow-hidden">
        <OfficeView />
      </div>
    </div>
  );
}
