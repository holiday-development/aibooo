export function LimitExceeded() {
  return (
    <div className="h-full w-full p-8 flex flex-col justify-center">
      <h1 className="text-2xl text-center">一日の使用回数制限に達しました</h1>
      <p className="text-md text-center mt-4 text-primary">
        近日中に、有料版へのアップグレード機能をリリースします
      </p>
      <div className="w-[120px] h-[96px] flex justify-center mt-6 mx-auto">
        <img src="/ai.svg" alt="ai" />
      </div>
    </div>
  );
}
