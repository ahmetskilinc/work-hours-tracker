"use client";

import { useEffect, useState } from "react";
import { format, parseISO, differenceInSeconds } from "date-fns";
import { getCurrentClockStatus } from "@/actions/clock";
import { ClockButton } from "./clock-button";
import { Spinner } from "./ui/spinner";

interface ClockPageClientProps {
  hourlyRate: number;
  currency: string;
}

export function ClockPageClient({
  hourlyRate,
  currency,
}: ClockPageClientProps) {
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [earnings, setEarnings] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCurrentClockStatus()
      .then((status) => {
        setClockInTime(status.clockInTime || null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (clockInTime) {
      // Initial calculation
      const clockInDate = parseISO(clockInTime);
      setElapsedTime(differenceInSeconds(new Date(), clockInDate));

      // Update every second
      intervalId = setInterval(() => {
        const seconds = differenceInSeconds(new Date(), clockInDate);
        setElapsedTime(seconds);
        // Calculate earnings (hourlyRate / 3600 gives us rate per second)
        setEarnings((seconds * hourlyRate) / 3600);
      }, 1000);
    } else {
      setElapsedTime(0);
      setEarnings(0);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [clockInTime, hourlyRate]);

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        {clockInTime ? (
          <div className="mb-4 space-y-4">
            <div>
              <p>Clocked in at</p>
              <p className="font-mono text-2xl font-bold">
                {format(parseISO(clockInTime), "h:mm a")}
              </p>
            </div>
            <div>
              <p>Time Worked</p>
              <p className="font-mono text-2xl font-bold">
                {formatElapsedTime(elapsedTime)}
              </p>
            </div>
            <div>
              <p>Earnings</p>
              <p className="font-mono text-2xl font-bold">
                {formatCurrency(earnings)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-lg text-muted-foreground">
            You are currently clocked out
          </p>
        )}
      </div>
      <ClockButton />
    </div>
  );
}