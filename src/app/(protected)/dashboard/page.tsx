import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CalendarDays,
  Clock,
  DollarSign,
  EuroIcon,
  LineChart,
  PoundSterling,
} from "lucide-react";
import { LogHoursButton } from "@/components/log-hours-button";
import { calculateHoursWorked, formatTimeString } from "@/lib/utils";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  subMonths,
  subWeeks,
} from "date-fns";
import { Database } from "@/lib/database.types";

type WorkLog = Database["public"]["Tables"]["work_logs"]["Row"];

const Dashboard = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  if (!data.user.user_metadata?.onboarding_completed) {
    redirect("/account/onboarding");
  }

  const { data: default_hourly_rate } = await supabase
    .from("user_profiles")
    .select("default_wage")
    .eq("user_id", data.user.id)
    .single();

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const { data: currentWeekLogs } = await supabase
    .from("work_logs")
    .select("*")
    .eq("user_id", data.user.id)
    .gte("date", currentWeekStart.toISOString())
    .lte("date", currentWeekEnd.toISOString())
    .order("date", { ascending: true });

  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), {
    weekStartsOn: 1,
  });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const { data: lastWeekLogs } = await supabase
    .from("work_logs")
    .select("*")
    .eq("user_id", data.user.id)
    .gte("date", lastWeekStart.toISOString())
    .lte("date", lastWeekEnd.toISOString());

  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  const { data: currentMonthLogs } = await supabase
    .from("work_logs")
    .select("*")
    .eq("user_id", data.user.id)
    .gte("date", currentMonthStart.toISOString())
    .lte("date", currentMonthEnd.toISOString());

  const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));
  const { data: lastMonthLogs } = await supabase
    .from("work_logs")
    .select("*")
    .eq("user_id", data.user.id)
    .gte("date", lastMonthStart.toISOString())
    .lte("date", lastMonthEnd.toISOString());

  // Get recent logs for the list
  const { data: recentLogs } = await supabase
    .from("work_logs")
    .select("*")
    .eq("user_id", data.user.id)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(5);

  const calculateTotalHours = (logs: WorkLog[]) => {
    return (
      logs?.reduce((total, log) => {
        return total + calculateHoursWorked(log.start_time!, log.end_time!);
      }, 0) || 0
    );
  };

  const calculateTotalEarnings = (logs: WorkLog[]) => {
    return (
      logs?.reduce((total, log) => {
        const rate = log.default_rate
          ? default_hourly_rate?.default_wage
          : log.custom_rate;
        return (
          total + calculateHoursWorked(log.start_time!, log.end_time!) * rate
        );
      }, 0) || 0
    );
  };

  const currentWeekHours = calculateTotalHours(currentWeekLogs || []);
  const lastWeekHours = calculateTotalHours(lastWeekLogs || []);
  const hoursChange = currentWeekHours - lastWeekHours;

  const currentMonthEarnings = calculateTotalEarnings(currentMonthLogs || []);
  const lastMonthEarnings = calculateTotalEarnings(lastMonthLogs || []);
  const earningsChange = currentMonthEarnings - lastMonthEarnings;

  const daysWorkedThisMonth = new Set(currentMonthLogs?.map((log) => log.date))
    .size;

  const averageDailyHours = daysWorkedThisMonth
    ? calculateTotalHours(currentMonthLogs || []) / daysWorkedThisMonth
    : 0;

  const lastMonthDaysWorked = new Set(lastMonthLogs?.map((log) => log.date))
    .size;
  const lastMonthAverageDailyHours = lastMonthDaysWorked
    ? calculateTotalHours(lastMonthLogs || []) / lastMonthDaysWorked
    : 0;
  const averageHoursChange = averageDailyHours - lastMonthAverageDailyHours;

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyData = weekDays.map((day, index) => {
    const dayLogs =
      currentWeekLogs?.filter((log) => {
        const logDate = new Date(log.date);
        return logDate.getDay() === (index + 1) % 7;
      }) || [];
    return {
      day,
      hours: calculateTotalHours(dayLogs),
    };
  });

  const maxHours = Math.max(...weeklyData.map((d) => d.hours), 8);

  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("default_wage, time_format, currency")
    .eq("user_id", data.user.id)
    .single();

  const currencySymbol =
    userProfile?.currency === "usd"
      ? "$"
      : userProfile?.currency === "eur"
        ? "€"
        : "£";

  const CurrencyIcon =
    userProfile?.currency === "usd"
      ? DollarSign
      : userProfile?.currency === "eur"
        ? EuroIcon
        : PoundSterling;

  return (
    <div className="flex-1 space-y-4 pt-6">
      <div className="container flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <LogHoursButton
            defaultHourlyRate={default_hourly_rate?.default_wage}
            timeFormat={userProfile?.time_format ?? "12h"}
            currencySymbol={currencySymbol}
          />
        </div>
      </div>

      <div className="container grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Hours This Week
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentWeekHours.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground">
              {hoursChange >= 0 ? "+" : ""}
              {hoursChange.toFixed(1)}h from last week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This Month&apos;s Earnings
            </CardTitle>
            <CurrencyIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencySymbol}
              {currentMonthEarnings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {earningsChange >= 0 ? "+" : ""}
              {currencySymbol}
              {earningsChange.toFixed(2)} from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Worked</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysWorkedThisMonth}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Daily Hours
            </CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageDailyHours.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground">
              {averageHoursChange >= 0 ? "+" : ""}
              {averageHoursChange.toFixed(1)}h from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="container grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Work Logs</CardTitle>
            <CardDescription>Your recent work activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentLogs?.map((log) => {
                const hours = calculateHoursWorked(
                  log.start_time,
                  log.end_time,
                );
                return (
                  <div key={log.id} className="flex items-center">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {format(new Date(log.date), "EEEE, MMMM d")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimeString(
                          log.start_time,
                          userProfile?.time_format,
                        )}{" "}
                        -{" "}
                        {formatTimeString(
                          log.end_time,
                          userProfile?.time_format,
                        )}
                      </p>
                    </div>
                    <div className="ml-auto font-medium">
                      {hours.toFixed(1)} hours • {currencySymbol}
                      {(
                        hours *
                        (log.default_rate
                          ? default_hourly_rate?.default_wage
                          : log.custom_rate)
                      ).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Weekly Overview</CardTitle>
            <CardDescription>Hours worked per day this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {weeklyData.map(({ day, hours }) => (
                <div key={day} className="flex items-center">
                  <div className="min-w-[4rem] font-medium">{day}</div>
                  <div className="flex flex-1 items-center gap-2">
                    <div
                      className="h-2 bg-primary"
                      style={{
                        width: `${(hours / maxHours) * 100}%`,
                      }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {hours.toFixed(1)}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;