"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";

function Circle({
  n,
  activeStep,
}: {
  n: number;
  activeStep: number;
}) {
  const done = activeStep > n;
  const active = activeStep === n;
  return (
    <div
      className={`relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold transition-all duration-300 ${
        done
          ? "bg-[#1877F2] text-white"
          : active
            ? "bg-[#1877F2] text-white shadow-[0_0_0_4px_rgba(24,119,242,0.22)]"
            : "border-2 border-[#D8DADF] bg-white text-[#8A8D91] dark:border-[#4a4c50] dark:bg-[#1c1e21] dark:text-[#8A8D91]"
      }`}
    >
      {done ? (
        <Check className="h-[18px] w-[18px]" strokeWidth={2.75} />
      ) : (
        n
      )}
    </div>
  );
}

function Segment({ complete }: { complete: boolean }) {
  return (
    <div className="relative mx-0.5 h-1 min-w-[8px] flex-1">
      <div className="absolute inset-0 rounded-full bg-[#E8EAED] dark:bg-[#3a3b3d]" />
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-[#1877F2] transition-all duration-500 ease-out"
        style={{ width: complete ? "100%" : "0%" }}
      />
    </div>
  );
}

export function StepProgress({
  activeStep,
  totalSteps,
}: {
  activeStep: number;
  totalSteps: 3 | 4;
}) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="bg-white px-4 pb-5 pt-4 dark:bg-[#121316]">
      <div className="mx-auto flex max-w-lg items-center">
        {steps.map((n, i) => (
          <Fragment key={n}>
            <Circle n={n} activeStep={activeStep} />
            {i < totalSteps - 1 ? (
              <Segment complete={activeStep >= n + 1} />
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
