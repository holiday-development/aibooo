import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { useScreenType } from '@/contexts/use-screen-type';
import { ArrowRightIcon, CommandIcon, PlusIcon, XIcon } from 'lucide-react';

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
  const { switchScreenType } = useScreenType();

  const handleClose = () => {
    switchScreenType('MAIN');
  };

  return (
    <Button size="icon" variant="ghost" onClick={handleClose}>
      <XIcon width={24} height={24} className="text-gray-400" />
    </Button>
  );
}

function CommandBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-12 h-12 flex items-center justify-center bg-white rounded-lg p-3 text-black text-2xl">
      {children}
    </div>
  );
}

function OnboardingCarousel() {
  const { switchScreenType } = useScreenType();

  const handleStart = () => {
    switchScreenType('MAIN');
  };

  return (
    <Carousel className="w-full h-full p-8">
      <CarouselContent>
        <CarouselItem>
          <h1 className="text-3xl">あなたの Aibooo</h1>
          <div className="h-[120px] flex justify-center mt-12 mx-auto">
            <img src="/ai.svg" alt="ai" />
          </div>
        </CarouselItem>
        <CarouselItem className="flex flex-col justify-between gap-8">
          <div className="flex justify-start items-center gap-2">
            <CommandBlock>
              <CommandIcon />
            </CommandBlock>
            <PlusIcon />
            <CommandBlock>C</CommandBlock>
            <div className="px-4">
              <ArrowRightIcon />
            </div>
            <CommandBlock>
              <CommandIcon />
            </CommandBlock>
            <PlusIcon />
            <CommandBlock>D</CommandBlock>
          </div>
          <img src="/usage-example.svg" alt="usage example" />
        </CarouselItem>
        <CarouselItem>
          <div className="flex gap-4">
            <h1 className="text-3xl">限りなくシームレス</h1>
            <Button size="lg" onClick={handleStart}>
              さあ、始めよう
            </Button>
          </div>
          <div className="h-[200px] flex justify-center mt-12 mx-auto">
            <img src="/generation-example.svg" alt="generation example" />
          </div>
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
