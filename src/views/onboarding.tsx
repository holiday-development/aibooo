import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

export function Onboarding() {
  return (
    <div className="h-full w-full p-8 flex flex-col">
      <div className="absolute top-2 right-2">
        <CloseButton />
      </div>
      <h1 className="text-3xl">あなたの Aibooo</h1>
      <div className="h-[120px] flex justify-center mt-12 mx-auto">
        <img src="/ai.svg" alt="ai" />
      </div>
    </div>
  );
}

function CloseButton() {
  return (
    <Button size="icon" variant="ghost">
      <XIcon width={24} height={24} className="text-gray-400" />
    </Button>
  );
}
