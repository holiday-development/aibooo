import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { XIcon } from 'lucide-react';

export function Onboarding() {
  return (
    <div className="h-full w-full">
      <div className="absolute top-2 right-2">
        <CloseButton />
      </div>
      <OnboardingCarousel />
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

function OnboardingCarousel() {
  return (
    <Carousel className="w-full h-full p-8">
      <CarouselContent>
        <CarouselItem>
          <h1 className="text-3xl">あなたの Aibooo</h1>
          <div className="h-[120px] flex justify-center mt-12 mx-auto">
            <img src="/ai.svg" alt="ai" />
          </div>
        </CarouselItem>
        <CarouselItem>
          <div>2</div>
        </CarouselItem>
      </CarouselContent>
      <div className="absolute bottom-4 left-10 z-10">
        <CarouselPrevious />
      </div>
      <div className="absolute bottom-4 right-10 z-10">
        <CarouselNext />
      </div>
    </Carousel>
  );
}
